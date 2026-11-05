/* ===================== 시연용 가상 학습 로그 ===================== */

function rng_(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var DEMO_CATEGORIES = {
  '읽기': ['부호를 잘못 옮겨 씀', '수를 잘못 옮겨 씀', '조건을 빠뜨리고 읽음'],
  '이해': ['구하는 것을 오해함', '조건의 의미를 모름', '그림·그래프 해석 어려움'],
  '변형': ['인수분해 방법 선택 오류', '곱셈 공식 적용 오류', '근의 공식 대입 오류', '원주각·중심각 관계 혼동', '꼭짓점 좌표 부호 혼동', '삼각형 넓이 공식 오적용', '제곱근 성질 오해', '평균 식 세우기 오류'],
  '처리기술': ['부호 계산 실수', '분수 계산 실수', '곱셈 계산 실수', '이항 실수', '근호 계산 실수'],
  '인코딩': ['답의 형태 미완성', '근을 하나만 씀', '단위·기호 누락', '좌표 형태로 쓰지 않음']
};

function pickW_(r, pairs) {
  var x = r(), acc = 0;
  for (var i = 0; i < pairs.length; i++) { acc += pairs[i][1]; if (x < acc) return pairs[i][0]; }
  return pairs[pairs.length - 1][0];
}

function createDemoData_() {
  var r = rng_(20261030);
  // 지금 출제된 문항(문제 이미지 문항 포함)으로 가상 기록을 만든다. 출제가 없으면 샘플 문항.
  var assignedIds = {};
  rows_(SH.ASSIGN).forEach(function (a) { assignedIds[str_(a['문항ID'])] = true; });
  var items = allItems_().filter(function (it) { return assignedIds[it.id]; });
  if (!items.length) items = allItems_().filter(function (it) { return it.source === '샘플'; });
  if (!items.length) throw new Error('출제된 문항이 없어요. 먼저 [① 초기 설정]을 실행해 주세요.');
  var students = rows_(SH.STUDENT).filter(function (s) { return str_(s['가상여부']) === 'Y'; });
  if (!students.length) throw new Error('가상 학생이 없어요.');

  // 시연용 계정: 각 반 1~3번 (비밀번호 1234)
  students.forEach(function (s) {
    if (num_(s['번호'], 0) <= 3 && str_(s['가입여부']) !== 'Y') {
      var salt = newSalt_();
      updateObj_(SH.STUDENT, s._row, { '비밀번호해시': hashPw_('1234', salt), '솔트': salt, '가입여부': 'Y', '가입일시': now_() });
    }
  });

  var basic = basicCalcCandidates_('중3');
  var conceptPool = {};
  items.forEach(function (it) {
    conceptPool[it.id] = [{ id: it.conceptId, name: it.conceptName }].concat(prereqCandidates_(it.conceptId, { depth: 2, min: 3, limit: 6 }));
  });
  var teacherOf = {};
  rows_(SH.TEACHER).forEach(function (t) { splitList_(t['담당반']).forEach(function (c) { teacherOf[c] = str_(t['교사ID']); }); });

  var subs = [], errs = [], helps = [];
  var nowMs = new Date().getTime();
  students.forEach(function (s, si) {
    var sid = str_(s['학생ID']), cls = str_(s['반']);
    var n = 4 + Math.floor(r() * 7);
    for (var k = 0; k < n; k++) {
      var it = items[Math.floor(r() * items.length)];
      var when = Utilities.formatDate(new Date(nowMs - Math.floor(r() * 21 * 86400000)), TZ, 'yyyy-MM-dd HH:mm:ss');
      var subId = 'SUB-DEMO-' + si + '-' + k;
      var res = pickW_(r, [['O', 0.55], ['X', 0.40], ['보류', 0.05]]);
      var primary = '';
      if (res === 'X') {
        primary = pickW_(r, [['읽기', 0.08], ['이해', 0.15], ['변형', 0.40], ['처리기술', 0.27], ['인코딩', 0.10]]);
        var stages = [primary];
        if (r() < 0.3) stages.push(r() < 0.6 ? '처리기술' : '인코딩');
        stages.forEach(function (stg, ei) {
          var c = { id: '', name: '' };
          if (stg === '변형' || stg === '이해') { var pool = conceptPool[it.id]; c = pool[Math.floor(r() * pool.length)]; }
          if (stg === '처리기술') {
            // 가상 기록도 실제 규칙과 같게: 그 문항의 핵심 개념 묶음은 계산 실수 개념으로 쓰지 않는다
            var core = {}; coreConcepts_(it).forEach(function (x) { core[x.id] = true; });
            var outside = basic.filter(function (b) { return !core[String(b.id)]; });
            if (outside.length) c = outside[Math.floor(r() * outside.length)];
          }
          var cats = DEMO_CATEGORIES[stg];
          errs.push({
            '오류ID': 'E-DEMO-' + si + '-' + k + '-' + ei, '제출ID': subId, '학생ID': sid, '반': cls, '문항ID': it.id, '문항코드': it.code,
            '줄번호': 1 + Math.floor(r() * 4), 'Newman단계': stg, '주원인여부': ei === 0 && stg === primary ? 'Y' : 'N', '개념id': c.id, '개념명': c.name,
            '오류유형': cats[Math.floor(r() * cats.length)], '설명': '(가상 데이터)', '판단근거': '(가상 데이터)', '불확실성': '',
            '확신도': Math.round((0.6 + r() * 0.35) * 100) / 100, '출처': 'AI', '기록일시': when, '가상여부': 'Y'
          });
        });
      }
      subs.push({
        '제출ID': subId, '학생ID': sid, '반': cls, '과제ID': '', '문항ID': it.id, '문항코드': it.code, '개념id': it.conceptId,
        '시도구분': '원문항', '시도차수': 1, '이해못함': primary === '이해' ? 'Y' : 'N', 'AI전사': '{"lines":[]}', '학생수정본': '[]',
        '자기교정': 'N', '학생최종답': '(가상)', '정오': res, '주원인': primary, '확신도': res === 'X' ? 0.8 : '',
        '판단근거': '(가상 데이터)', '상태': res === '보류' ? '판단보류' : '분석완료', '제출일시': when, '분석일시': when, '가상여부': 'Y'
      });
      if (res === '보류') {
        helps.push({
          '요청ID': 'H-DEMO-' + si + '-' + k, '제출ID': subId, '학생ID': sid, '반': cls, '문항ID': it.id, '교사ID': teacherOf[cls] || '',
          '사유': '[가상] 판단 근거 부족: 풀이 없이 답만 적음', '상태': helps.length % 3 === 0 ? '대기' : '답변완료',
          '교사답변': helps.length % 3 === 0 ? '' : '(가상) 풀이 과정을 한 줄씩 써 보면 어디서 틀렸는지 찾기 쉬워요.', '학생확인': 'N', '요청일시': when, '답변일시': ''
        });
      }
    }
  });
  appendObjs_(SH.SUBMIT, subs);
  appendObjs_(SH.ERROR, errs);
  appendObjs_(SH.HELP, helps);
  rebuildScores_();
  return '가상 학생 ' + students.length + '명의 풀이 ' + subs.length + '건, 오류 ' + errs.length + '건, 교사확인요청 ' + helps.length + '건을 만들었어요.\n각 반 1~3번 학생은 비밀번호 1234로 로그인할 수 있어요.';
}

function keepRows_(name, keep) {
  var sh = sheet_(name);
  if (sh.getLastRow() < 2) return 0;
  var lc = sh.getLastColumn();
  var hdr = headers_(name);
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, lc).getValues();
  var kept = data.filter(function (row) {
    var o = {};
    hdr.forEach(function (h, c) { o[h] = plain_(row[c]); });
    return keep(o);
  });
  sh.getRange(2, 1, data.length, lc).clearContent();
  if (kept.length) sh.getRange(2, 1, kept.length, lc).setValues(kept);
  return data.length - kept.length;
}

function clearDemoData_() {
  var a = keepRows_(SH.SUBMIT, function (o) { return str_(o['가상여부']) !== 'Y'; });
  var b = keepRows_(SH.ERROR, function (o) { return str_(o['가상여부']) !== 'Y'; });
  var c = keepRows_(SH.HELP, function (o) { return String(o['사유']).indexOf('[가상]') !== 0; });
  var d = 0;
  rows_(SH.STUDENT).forEach(function (s) {
    if (str_(s['가상여부']) === 'Y' && str_(s['가입여부']) === 'Y') { updateObj_(SH.STUDENT, s._row, { '가입여부': 'N', '비밀번호해시': '', '솔트': '' }); d++; }
  });
  rebuildScores_();
  return '가상 풀이 ' + a + '건, 오류 ' + b + '건, 교사확인요청 ' + c + '건을 지우고, 시연용 계정 ' + d + '개의 가입을 풀었어요.\n점수도 다시 계산했어요. 이제 실제 학생이 같은 학번으로 가입하면 입력한 이름으로 저장돼요.';
}
