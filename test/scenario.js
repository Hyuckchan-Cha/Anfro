// 서버 흐름 모의 실행: 초기 설정 → 가입 → 전사 → 분석(변형) → 유도질문(선수개념 추적) → 회귀 → 적용 → 교사 기능 → 가상 데이터
var fx = JSON.parse(std.loadFile('dev/fixtures.json'));
Object.keys(fx).forEach(function (name) {
  var s = __ss.insertSheet(name);
  s.maxRows = fx[name].length + 10; s.maxCols = Math.max(26, fx[name][0].length);
  s.getRange(1, 1, fx[name].length, fx[name][0].length).setValues(fx[name].map(function (r) { var o = r.slice(); while (o.length < fx[name][0].length) o.push(''); return o; }));
});
var fails = 0;
function ok(cond, msg) { if (!cond) { fails++; print('FAIL ' + msg); } else print('ok   ' + msg); }
function call(r, label) { if (!r.ok) { print('  -> ' + label + ' error: ' + r.error + ' [' + r.code + ']'); } return r; }
function sheetRows(name) { return rows_(name); }

print('--- setup');
print(setupAll_().split('\n').map(function (l) { return '  ' + l; }).join('\n'));
ok(sheetRows(SH.STUDENT).length === 150, '학생 150명');
ok(str_(sheetRows(SH.STUDENT)[0]['학생ID']) === '30101', '학번 30101 형식: ' + sheetRows(SH.STUDENT)[0]['학생ID']);
ok(sheetRows(SH.ITEM).length === 9, '샘플 문항 9개');
ok(headers_(SH.MISCON).join('|') === '학생이름|학생id|오개념 개념 코드|판단|개념명|이해수준|출처|근거|문항ID|기록일시', '오개념도표 머리글(판단·출처 등)');
// 초기 설정을 겹쳐 눌러 두 벌씩 들어간 상황 → 다시 실행하면 정리
appendObjs_(SH.ITEM, rows_(SH.ITEM).map(function (r) { var o = Object.assign({}, r); delete o._row; return o; }));
appendObjs_(SH.ASSIGN, rows_(SH.ASSIGN).map(function (r) { var o = Object.assign({}, r); delete o._row; o['과제ID'] = o['과제ID'] + 'dup'; return o; }));
appendObjs_(SH.STUDENT, rows_(SH.STUDENT).slice(0, 30).map(function (r) { var o = Object.assign({}, r); delete o._row; return o; }));
ok(rows_(SH.ITEM).length === 18 && rows_(SH.ASSIGN).length === 36, '중복 상황 재현');
// 예전 설정 이름(레+포+트)이 남은 DB: 다시 설치하면 '리포트'로 이름이 바뀌고 중복 행이 생기지 않아야 한다
(function () {
  var OLD = '레포트', cfgS = sheet_(SH.CONFIG), vals = cfgS.getRange(2, 1, cfgS.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]).indexOf('리포트기준') >= 0) cfgS.getRange(i + 2, 1, 1, 3).setValues([[String(vals[i][0]).replace('리포트', OLD), vals[i][1], String(vals[i][2]).replace(/리포트/g, OLD)]]);
})();
var again = setupAll_();
ok(rows_(SH.ITEM).length === 9 && rows_(SH.ASSIGN).length === 18 && rows_(SH.STUDENT).length === 150 && again.indexOf('중복으로 들어간 행 57개') >= 0, '다시 실행하면 중복 정리: ' + again.split('\n')[1]);
PropertiesService.getScriptProperties().setProperty('SETUP_RUNNING', String(Date.now()));
var busy = null; try { setupAll_(); } catch (e) { busy = e.message; }
ok(busy && busy.indexOf('이미 실행 중') >= 0, '실행 중에 또 누르면 막음');
(function () {
  var keys = sheet_(SH.CONFIG).getRange(2, 1, sheet_(SH.CONFIG).getLastRow() - 1, 3).getValues();
  var old = keys.filter(function (r) { return /레포트/.test(r[0] + r[2]); }).length;
  var n = keys.filter(function (r) { return String(r[0]) === '처리기술리포트기준'; }).length;
  ok(old === 0 && n === 1, '예전 설정 이름을 리포트로 바꿈(중복 없음)');
})();
PropertiesService.getScriptProperties().deleteProperty('SETUP_RUNNING');

print('--- teacher');
var tl = call(api_teacherLogin({ loginId: 'hong', password: '1234' }), 'teacherLogin');
ok(tl.ok, '교사 로그인');
var TT = tl.data.token;
ok(call(api_teacherSettings(TT), 'settings0').data.model === 'gpt-5.4-mini', '기본 모델 gpt-5.4-mini');
ok(call(api_saveTeacherSettings(TT, { provider: 'gemini', model: 'gpt-6-sol', apiKey: 'sk-test-1234567890abcdef' }), 'save').ok, 'API 키 저장');
ok(call(api_testAi(TT), 'testAi').ok, '연결 테스트');
ok(__lastReq.url === 'https://hello.timelyai.io/api/v2/chat/bridge/openai/chat/completions' && __lastReq.headers.Authorization === 'Bearer sk-test-1234567890abcdef', '기본 주소(브리지)/chat/completions + Bearer 헤더: ' + __lastReq.url);
ok(call(api_teacherSettings(TT), 'st-base').data.baseUrl === 'https://hello.timelyai.io/api/v2/chat/bridge/openai', '설정에 기본 API 주소 표시');
ok(!api_saveTeacherSettings(TT, { baseUrl: 'http://insecure.example' }).ok, 'https 아닌 주소 거절');
ok(call(api_saveTeacherSettings(TT, { baseUrl: 'https://api.openai.com/v1/' }), 'base-openai').ok && api_saveTeacherSettings(TT, { apiKey: 'tl-any-format-key-123456' }).ok && call(api_saveTeacherSettings(TT, { apiKey: 'sk-test-1234567890abcdef' }), 'key-back').ok, 'API 키 형식(sk-) 제한 없음');
__notFound['https://proxy.example/v9/chat/completions'] = true;
ok(call(api_saveTeacherSettings(TT, { baseUrl: 'https://proxy.example/v9' }), 'base-proxy').ok && call(api_testAi(TT), 'test-proxy').ok && __lastReq.url === 'https://proxy.example/v9', '/chat/completions가 404면 주소 자체로 재시도');
__urlLog = []; call(api_testAi(TT), 'test-proxy2');
ok(__urlLog.length === 1 && __urlLog[0] === 'https://proxy.example/v9', '성공한 주소를 기억해 바로 사용');
__rejectParams = true; __urlLog = [];
ok(call(api_testAi(TT), 'test-reject').ok && __urlLog.length === 2 && !__lastReq.body.reasoning_effort && !__lastReq.body.response_format, '모르는 옵션 400 → 옵션 빼고 재시도');
__rejectParams = false;
ok(call(api_saveTeacherSettings(TT, { baseUrl: '' }), 'base-reset').ok, '주소 비우기 → 기본값');
call(api_testAi(TT), 'test-reset');
ok(__lastReq.url.indexOf('https://hello.timelyai.io/') === 0, '기본 주소로 복귀');
ok(__lastReq.body.model === 'gpt-6-sol' && __lastReq.body.reasoning_effort === 'low' && __lastReq.body.temperature === undefined, 'GPT-6: reasoning_effort 사용, temperature 없음');
ok(call(api_saveTeacherSettings(TT, { model: 'gpt-4.1' }), 'save41').ok && call(api_testAi(TT), 'test41').ok && __lastReq.body.temperature === 0 && !__lastReq.body.reasoning_effort, 'GPT-4.1: temperature 사용');
ok(call(api_saveTeacherSettings(TT, { model: '' }), 'saveDefault').ok && call(api_teacherSettings(TT), 's2').data.model === 'gpt-5.4-mini', '빈 모델 → 기본 mini');
var st = call(api_teacherSettings(TT), 'settings');
ok(st.ok && st.data.keyStatus.indexOf('…cdef') > 0 && JSON.stringify(st.data).indexOf('sk-test') < 0, '키 가림: ' + (st.data && st.data.keyStatus));

print('--- student');
var bad = api_studentLogin({ cls: '1', num: '5', password: '1234' });
ok(!bad.ok && bad.error.indexOf('회원가입') >= 0, '미가입 로그인 안내: ' + bad.error);
var reg = call(api_studentRegister({ cls: '1', num: '5', name: '테스트학생', password: 'abcd', password2: 'abcd' }), 'register');
ok(reg.ok, '회원가입');
var dup = api_studentRegister({ cls: '1', num: '5', name: '테스트학생', password: 'abcd', password2: 'abcd' });
ok(!dup.ok && dup.error.indexOf('선생님에게 문의하세요') >= 0, '중복 가입 안내: ' + dup.error);
var lg = call(api_studentLogin({ cls: '1', num: '5', name: '테스트학생', password: 'abcd' }), 'login');
ok(lg.ok, '학생 로그인');
var TS = lg.data.token;
var home = call(api_studentHome(TS), 'home');
ok(home.ok && home.data.items.length === 9, '문제 목록 9개');
var asg = home.data.items[3].assignmentId; // 인수분해를 이용한 이차방정식
var v = call(api_openProblem(TS, asg), 'open');
ok(v.ok && v.data.problem && !v.data.problem.answer, '문제 열기(정답 숨김)');
var img = 'data:image/jpeg;base64,' + new Array(2000).join('A');
var tr = call(api_transcribe(TS, { assignmentId: asg, imageBase64: img, mime: 'image/jpeg' }), 'transcribe');
var ocrMsg = __lastReq.body.messages[1].content, ocrUser = typeof ocrMsg === 'string' ? ocrMsg : ocrMsg[0].text;
ok(ocrUser.indexOf('[개념] (9832)') >= 0 && ocrUser.indexOf('학생 풀이 1장') >= 0, '전사에 문항 개념명 전달');
var preKey = Object.keys(prereqMap_().pre).filter(function (k) { return conceptInfo_(k) && directPrereqs_(k).length >= 2; })[0];
var preList = directPrereqs_(preKey, 8), preRaw = prereqMap_().pre[preKey];
var preUser = promptOcrUser_({ text: '문제', conceptId: preKey, conceptName: conceptInfo_(preKey).name, grade: '중3' }, { prereqs: preList, hasProblemImage: false });
ok(preList.every(function (c) { return preRaw.indexOf(c.id) >= 0; }) && preUser.indexOf('[선수개념] ' + preList[0].name + '(') >= 0 && preUser.indexOf(preList[1].name) >= 0, '전사에 그 개념을 후수개념으로 가진 선수개념 전달: ' + preList.map(function (c) { return c.name; }).slice(0, 3).join(', '));
ok(promptOcrSystem_().indexOf('고치거나, 빠진 부분을 채우거나') >= 0 && promptOcrSystem_().indexOf('[그림 1:') >= 0, '전사 지침: 개념 정보로 고치지 않음, 그림은 자리표시만');
ok(tr.ok && tr.data.lines.length === 3 && tr.data.lines[1].uncertain, '전사 3줄, 불확실 표시');
__analysisQueue.push({ student_final_answer: 'x=3 또는 x=-4', is_correct: false, evidence_sufficient: true,
  errors: [{ line: 2, stage: '변형', concept_id: '10169', concept_name: '인수분해', category: '인수분해 부호 오류', description: '부호를 반대로', evidence: '(x-3)(x+4)', uncertainty: '', confidence: 0.85 },
    { line: 3, stage: '인코딩', concept_id: null, category: '답의 형태', description: 'x', evidence: 'x', confidence: 0.7 }],
  misconceptions: [{ concept_id: '10169', concept_name: '인수분해', reason: '합과 곱 부호 혼동', student_belief: '학생은 두 수의 곱만 맞으면 된다고 생각하는 것 같다' }], self_correction: { occurred: false },
  student_intent: { strategy: '인수분해로 이차방정식을 풀려 함', fits_problem: true },
  line_checks: [{ line: 2, intent: '곱이 -12인 두 수로 인수분해하려 함', ok: false }],
  understanding: { level: '부분 이해', evidence: '곱은 맞췄지만 합의 부호를 확인하지 않음', strengths: ['인수분해로 푸는 전략 선택'], gaps: ['합 조건 확인'], check_question: '두 수의 합은 얼마여야 할까요?' } });
var fb = call(api_submitSolution(TS, { submissionId: tr.data.submissionId, lines: [{ text: 'x^2-x-12=0' }, { text: '(x-3)(x+4)=0' }, { text: 'x=3 또는 x=-4' }] }), 'submit');
ok(fb.ok && fb.data.result === 'wrong' && fb.data.stage === '변형' && fb.data.startTutor, '변형 오류 → 유도질문 시작: ' + (fb.data && fb.data.stage));
ok(__lastReq.body.model === 'gpt-5.4-mini' && __lastReq.body.reasoning_effort === 'high' && __lastReq.body.temperature === undefined, '오류 분석: gpt-5.4-mini, reasoning_effort=high');
ok(Array.isArray(__lastReq.body.messages[1].content) && __lastReq.body.messages[1].content.some(function (c) { return c.type === 'image_url'; }), '오류 분석 호출에 풀이 사진 포함');
ok(sheetRows(SH.MISCON).length === 1 && str_(sheetRows(SH.MISCON)[0]['오개념 개념 코드']) === '10169', '오개념도표 행 추가 (10169)');
ok(sheetRows(SH.ERROR).length === 2, '오류기록 2행');
var anaSaved = (parseJson_(getObj_(SH.SUBMIT, fb.data.submissionId)['AI분석'], {}) || {}).outcome || {};
ok(anaSaved.understanding && anaSaved.understanding.level === '부분 이해' && anaSaved.intent.strategy.indexOf('인수분해') >= 0 && anaSaved.beliefs.length === 1 && anaSaved.intent.lines[0].ok === false, '분석에 의도·이해 수준·학생 생각 저장');
ok(__llmLog.filter(function (l) { return l.sys.indexOf('너는 중학교 수학 교사를 돕는') === 0; }).length > 0, '분석 호출 기록');
ok(promptAnalysisSystem_().indexOf('학생의 생각 읽기') >= 0 && promptAnalysisSystem_().indexOf('"understanding"') >= 0, '분석 프롬프트: 의도·이해 수준 항목');
// 피타고라스 정리를 잘못 적용(빗변 착각) → 원인 개념은 피타고라스 정리(중2), 제곱근이 아님
var pyCtx = buildAnalysisContext_(getItem_('Q-SAMPLE-01'), [], [{ text: 'x²=6²+8²' }], false);
var pyOut = decideOutcome_({ is_correct: false, evidence_sufficient: true,
  errors: [{ line: 1, stage: '변형', concept_id: null, concept_name: '피타고라스 정리', category: '빗변 착각', confidence: 0.9 }],
  misconceptions: [{ concept_id: '78', concept_name: '제곱근' }] }, pyCtx);
ok(pyOut.misconceptions[0] === '8404' && pyOut.errors[0].conceptName === '피타고라스 정리', '후보에 없는 개념 이름도 전체 목록에서 찾고, 주 오류 개념을 맨 앞에: ' + pyOut.misconceptions.join(','));
ok(promptAnalysisSystem_().indexOf('틀린 줄에서 학생이 적용하려다 잘못 적용한 개념') >= 0, '분석 프롬프트: 원인 개념 고르기 규칙');
ok(promptTutorSystem_().indexOf('[질문 쓰는 법]') >= 0 && promptTutorSystem_().indexOf('예/아니요로 답할 수 있는 질문은 피한다') >= 0, '튜터 프롬프트: 질문 쓰는 법');
// 중2 이하 개념 문제는 AI로 만들어 저장하고, 다음에는 다시 쓴다
var nGen = __llmLog.length;
var py1 = pickSimilarForConcept_(teacherAiConfig_('T01'), '8404', 0, {}, null);
var py2 = pickSimilarForConcept_(teacherAiConfig_('T01'), '8404', 0, {}, null);
ok(py1 && py1.conceptId === '8404' && py1.grade === '중2' && py1.source === 'AI생성' && getItem_(py1.id) && py2.id === py1.id && __llmLog.length === nGen + 1, '중2 개념 문제: AI 생성 → 문항리스트 저장 → 다시 쓸 때 재사용');
var holdCtx = buildAnalysisContext_(getItem_('Q-SAMPLE-01'), [], [], false);
var hWrong = decideOutcome_({ is_correct: false, evidence_sufficient: true, process_ok: false, line_checks: [{ line: 1, ok: false, why: '계산 오류' }], errors: [] }, holdCtx);
var hRight = decideOutcome_({ is_correct: true, evidence_sufficient: true, process_ok: false, line_checks: [{ line: 1, ok: false, why: '부호 불일치' }], errors: [] }, holdCtx);
ok(hWrong.result === 'hold' && hWrong.holdReason.indexOf('오답이며') === 0 && hRight.holdReason.indexOf('최종 답은 맞지만') === 0, '보류 사유: 오답이면 "오답이며…", 답이 맞으면 "최종 답은 맞지만…"');
ok(decideOutcome_({ is_correct: true, understanding: { level: '아주 잘함' } }, buildAnalysisContext_(getItem_('Q-SAMPLE-01'), [], [], false)).understanding.level === '판단 어려움', '알 수 없는 이해 수준 → 판단 어려움');
var ss1 = sheetRows(SH.STAGESUM).filter(function (r) { return str_(r['학생ID']) === '30105'; })[0];
ok(ss1 && ss1['주원인_변형'] === 1 && ss1['인코딩점수'] === 1, '단계별집계 변형·인코딩 점수');

print('--- tutor');
var ts = call(api_tutorStart(TS, asg), 'tutorStart');
ok(ts.ok && ts.data.messages.length === 1 && ts.data.problem, '세션 시작 + 첫 질문: ' + (ts.data && ts.data.problem && ts.data.problem.id));
var sid = ts.data.sessionId;
__tutorQueue.push({ reply: '좋아요. 합이 $-1$이고 곱이 $-12$인 두 수는?', action: 'continue', step_index: 1, hint_level: 0, student_state: '부분이해', student_thinking: '곱은 맞췄지만 합의 부호를 확인하지 않음',
  candidate_checks: [{ concept_id: '10169', verdict: '확인됨', note: '곱만 맞추면 된다고 답함' }], check_problem: 'x^2+x-6을 인수분해해 볼까요?' });
var t1 = call(api_tutorSend(TS, sid, '인수분해를 해요', 'answer'), 'send1');
ok(__llmLog[__llmLog.length - 1].user.indexOf('[검증할 오개념 후보]') >= 0 && __llmLog[__llmLog.length - 1].user.indexOf('10169 | 인수분해') >= 0, '유도질문에 분석의 오개념 후보 전달');
ok(promptTutorSystem_().indexOf('candidate_checks') >= 0 && promptTutorSystem_().indexOf('최초의 오개념') >= 0 && promptTutorSystem_().indexOf('check_problem') >= 0, '튜터 지침: 후보 검증·확인 문제·최초 오개념 추적');
ok(__llmLog[__llmLog.length - 1].user.indexOf('[학생의 이해 수준] 부분 이해') >= 0 && __llmLog[__llmLog.length - 1].user.indexOf('[학생의 전략]') >= 0, '유도질문이 처음 분석의 의도·이해 수준에서 시작');
ok(__lastReq.body.messages[1].content.some && __lastReq.body.messages[1].content.some(function (c) { return c.type === 'image_url'; }), '유도질문 호출에 원래 풀이 사진 포함');
ok(t1.ok && t1.data.messages.length === 2, '대화 1턴');
__tutorQueue.push('PREREQ');
var t2 = call(api_tutorSend(TS, sid, '모르겠어요', 'dontknow'), 'send2');
ok(__llmLog.some(function (l) { return l.user.indexOf('[지금까지 파악한 학생의 생각] 곱은 맞췄지만 합의 부호를 확인하지 않음') >= 0; }), '튜터가 파악한 학생의 생각을 다음 턴에 이어 씀');
ok(t2.ok && t2.data.view.path.length === 2, '선수개념으로 내려감: ' + (t2.data && t2.data.view.path.map(function (p) { return p.name; }).join(' > ')));
__tutorQueue.push({ reply: '잘했어요! 핵심: 분배법칙', action: 'solved', step_index: 1, hint_level: 2, student_state: '이해함', concept_verdict: { understood: false, level: '부분 이해', reason: '힌트 2단계가 있어야 분배법칙을 적용함' } });
var t3 = call(api_tutorSend(TS, sid, 'x^2+5x+6', 'answer'), 'send3');
ok(t3.ok && t3.data.view.path.length === 1, '선수개념 해결 → 원래 문제로 복귀');
ok(sheetRows(SH.MISCON).length === 2, '선수개념 결손 확인 → 오개념도표 행 추가');
var preRow = sheetRows(SH.MISCON)[1];
ok(miscVerdict_(preRow) === '오개념' && str_(preRow['출처']) === '유도질문' && str_(preRow['이해수준']) === '부분 이해' && str_(preRow['근거']).indexOf('선수개념 추적 1단계') >= 0 && str_(preRow['개념명']),
  '추적 단계 판정(AI): 선수개념 오개념·이해수준·근거 기록: ' + str_(preRow['개념명']));
__tutorQueue.push({ reply: '정답이에요!', action: 'solved', step_index: 2, hint_level: 0, student_state: '이해함' });
var t4 = call(api_tutorSend(TS, sid, '(x+3)(x-4)', 'answer'), 'send4');
ok(t4.ok && t4.data.finished && t4.data.nextStage === 'regress', '1단계 완료 → 2단계');
var sesRow = getObj_(SH.SESSION, sid), sesData = parseJson_(sesRow['상태데이터'], {});
ok(sesData.candidates[0].status === '확인됨' && str_(sesRow['진단결과']).indexOf('인수분해(확인됨)') >= 0, '후보 검증 결과가 세션 진단결과에 남음: ' + str_(sesRow['진단결과']));
ok(sheetRows(SH.MISCON).length === 2, '분석 때 이미 올린 오개념은 다시 올리지 않음');
var fakeData = { candidates: [{ conceptId: '5261', conceptName: '제곱근의 곱셈', status: '미정', notes: [] }], recordedConcepts: [] };
applyCandidateChecks_(requireStudent_(TS), sid, fakeData, { problemId: 'Q-SAMPLE-01' }, [{ concept_id: '5261', verdict: '확인됨', note: 'x' }, { concept_id: '9999', verdict: '확인됨' }]);
applyCandidateChecks_(requireStudent_(TS), sid, fakeData, { problemId: 'Q-SAMPLE-01' }, [{ concept_id: '5261', verdict: '확인됨' }]);
ok(sheetRows(SH.MISCON).length === 3 && rows_(SH.ERROR).filter(function (e) { return str_(e['오류유형']) === '오개념 확인(유도질문)'; }).length === 1, '새로 확인된 오개념은 한 번만 오개념도표·오류기록에 남김');
var fake2 = { candidates: [{ conceptId: '972', conceptName: '곱셈 공식', status: '미정', notes: [] }], recordedConcepts: [] };
applyCandidateChecks_(requireStudent_(TS), sid, fake2, { problemId: 'Q-SAMPLE-02' }, [{ concept_id: '972', verdict: '아님', note: '부호를 바르게 설명함' }]);
var notRow = sheetRows(SH.MISCON).filter(function (r) { return str_(r['오개념 개념 코드']) === '972'; })[0];
ok(notRow && miscVerdict_(notRow) === '이해함' && str_(notRow['출처']) === '유도질문' && fake2.verdicts['972'] === '이해함', '오개념 후보 아님 → 이해함');
var fake3 = { recordedConcepts: ['10169'] }, nRows = sheetRows(SH.MISCON).length;
tutorVerdict_(requireStudent_(TS), sid, fake3, { conceptId: '5261', conceptName: '제곱근의 곱셈', problemId: 'Q-SAMPLE-01' }, true, '개념적 이해', '스스로 해결');
tutorVerdict_(requireStudent_(TS), sid, fake3, { conceptId: '5261', conceptName: '제곱근의 곱셈', problemId: 'Q-SAMPLE-01' }, false, '', '다시');
tutorVerdict_(requireStudent_(TS), sid, fake3, { conceptId: '10169', conceptName: '인수분해', problemId: 'Q-SAMPLE-03' }, false, '', '이미 분석에서 올림');
ok(sheetRows(SH.MISCON).length === nRows + 1 && str_(sheetRows(SH.MISCON)[nRows]['이해수준']) === '개념적 이해', '한 세션에서 한 개념은 한 번만, 분석 때 올린 오개념은 다시 안 올림');

print('--- regress / apply');
var v2 = call(api_openProblem(TS, asg), 'open2');
ok(v2.data.progress.stage === 'regress' && !v2.data.latest, '2단계 화면');
var tr2 = call(api_transcribe(TS, { assignmentId: asg, imageBase64: img, mime: 'image/jpeg' }), 'tr2');
var fb2 = call(api_submitSolution(TS, { submissionId: tr2.data.submissionId, lines: [{ text: '(x+3)(x-4)=0' }], notUnderstood: false }), 'submit2');
ok(fb2.ok && fb2.data.nextStage === 'apply' && fb2.data.view.progress.stage === 'apply', '2단계 정답 → 3단계');
var okRow = sheetRows(SH.MISCON).filter(function (r) { return miscVerdict_(r) === '이해함' && str_(r['문항ID']) === v2.data.problem.id; })[0];
ok(okRow && str_(okRow['출처']) === '풀이분석' && str_(okRow['근거']).indexOf('정답') >= 0 && str_(okRow['오개념 개념 코드']) === getItem_(v2.data.problem.id).conceptId, '정답 → 문항 개념을 이해함으로 기록');
var origIt = getItem_(v2.data.problem.id), applyIt = getItem_(fb2.data.view.problem.id);
var tutorIts = tutorItemIdsFor_(requireStudent_(TS).id, asg).map(function (id) { return getItem_(id); });
ok(tutorIts.length >= 1 && tutorIts.every(function (it) { return it.diff < origIt.diff; }), '1단계 문제는 처음 문제보다 쉬움: 처음 ' + origIt.diff + ' / 1단계 ' + tutorIts.map(function (it) { return it.diff; }).join(','));
ok(applyIt.conceptId === origIt.conceptId && applyIt.id !== origIt.id && applyIt.diff >= origIt.diff - 0.3 && applyIt.diff <= origIt.diff + 1.0, '3단계 확인 문제: 같은 개념, 처음과 비슷하거나 조금 어려움 (' + origIt.diff + ' → ' + applyIt.diff + ')');
ok(tutorIts.every(function (it) { return it.id !== applyIt.id && it.code !== applyIt.code; }), '3단계 문제는 1단계에서 푼 문제·문항코드와 다름');
ok(seenItemIds_(requireStudent_(TS).id)[tutorIts[0].id], '끝난 유도질문 문제도 본 문제로 기억');
var tr3 = call(api_transcribe(TS, { assignmentId: asg, imageBase64: img, mime: 'image/jpeg' }), 'tr3');
var fb3 = call(api_submitSolution(TS, { submissionId: tr3.data.submissionId, lines: [{ text: 'x=1' }], notUnderstood: false }), 'submit3');
ok(fb3.ok && fb3.data.canNext && fb3.data.view.progress.stage === 'done', '3단계 정답 → 완료, 다음 문제');
var nx = call(api_nextAssignment(TS, asg), 'next');
ok(nx.ok && nx.data.assignmentId && nx.data.assignmentId !== asg, '다음 문제 이동');

print('--- other stages');
var asg2 = home.data.items[0].assignmentId;
call(api_openProblem(TS, asg2), 'open3');
var tr4 = call(api_transcribe(TS, { assignmentId: asg2, imageBase64: img, mime: 'image/jpeg' }), 'tr4');
__analysisQueue.push({ is_correct: false, evidence_sufficient: true, errors: [{ line: 1, stage: '처리기술', concept_id: '163', concept_name: '유리수의 덧셈', category: '부호 계산 실수', confidence: 0.9 }] });
var fb4 = call(api_submitSolution(TS, { submissionId: tr4.data.submissionId, lines: [{ text: '√36=5' }], notUnderstood: false }), 'submit4');
ok(fb4.ok && fb4.data.message === '계산실수가 있어요! 검산해보세요!', '처리기술 메시지');
// 핵심 개념(제곱근의 곱셈) 계산을 틀리면 계산 실수가 아니라 오개념(변형)
var sqItem = getItem_('Q-SAMPLE-01');
var sqCtx = buildAnalysisContext_(sqItem, [], [{ text: '√3×√12=√15' }], false);
ok(sqCtx.core.some(function (c) { return c.name === '제곱근의 나눗셈'; }) && !sqCtx.basic.some(function (c) { return sqCtx.coreIds[String(c.id)]; }), '핵심 개념 묶음(같은 중단원) 구성, 기초 계산 후보에서 제외: ' + sqCtx.core.length + '개');
var sqOut = decideOutcome_({ is_correct: false, evidence_sufficient: true, errors: [{ line: 1, stage: '처리기술', concept_id: '5261', confidence: 0.9 }] }, sqCtx);
ok(sqOut.result === 'wrong' && sqOut.primary === '변형' && sqOut.errors[0].stage === '변형', '핵심 개념 계산 오류 → 처리기술이 아니라 변형: ' + sqOut.primary);
var arOut = decideOutcome_({ is_correct: false, evidence_sufficient: true, errors: [{ line: 1, stage: '처리기술', concept_id: '163', confidence: 0.9 }] }, sqCtx);
ok(arOut.primary === '처리기술', '핵심 밖의 단순 계산(유리수의 덧셈)은 처리기술 유지: ' + arOut.primary);
// 특수각 삼각비 값을 틀리게 쓴 것(cos 30°=1/2)은 계산 실수가 아니라 개념 오류(변형)
var trOut = decideOutcome_({ is_correct: false, evidence_sufficient: true, errors: [{ line: 2, stage: '처리기술', concept_id: '163', category: '계산 실수', description: 'cos 30°를 1/2로 계산함', confidence: 0.9 }] }, sqCtx);
ok(trOut.primary === '변형' && /삼각비의 값/.test(trOut.errors[0].conceptName) && trOut.misconceptions.length > 0, '특수각 삼각비 값 오류(cos 30°=1/2) → 변형, 개념: ' + trOut.errors[0].conceptName);
var trOut2 = decideOutcome_({ is_correct: false, evidence_sufficient: true, errors: [{ line: 2, stage: '처리기술', concept_id: null, description: '$\\cos 30^{\\circ}=\\frac{1}{2}$로 씀', confidence: 0.9 }] }, sqCtx);
ok(trOut2.primary === '변형', 'LaTeX로 쓴 특수각(\\cos 30^{\\circ})도 변형: ' + trOut2.primary);
ok(promptAnalysisSystem_().indexOf('cos 30°') >= 0, '분석 프롬프트에 특수각 삼각비 값 규칙');
// 이해 여부는 제출할 때 보내지 않는다: AI가 고른 단계를 그대로 쓴다(변형을 이해로, 이해를 변형으로 바꾸지 않음)
ok(promptAnalysisUser_(buildAnalysisContext_(sqItem, [], [{ text: 'x' }])).indexOf('자기 보고') < 0 && promptAnalysisSystem_().indexOf('자기 보고') < 0, '분석 프롬프트에 학생 자기 보고 없음');
ok(decideOutcome_({ is_correct: false, evidence_sufficient: true, errors: [{ line: 1, stage: '변형', concept_id: '5261', confidence: 0.9 }] }, sqCtx).primary === '변형', '변형은 그대로 변형');
__analysisQueue.push({ is_correct: false, evidence_sufficient: true, errors: [{ line: 1, stage: '이해', concept_id: '5261', confidence: 0.9 }] });
var fb5 = call(api_submitSolution(TS, { submissionId: tr4.data.submissionId, lines: [{ text: '√36=6?' }] }), 'submit5');
ok(fb5.ok && fb5.data.stage === '이해' && fb5.data.showHelp && fb5.data.message.indexOf('[도움 받기]') >= 0, 'AI가 이해 단계로 보면 이해 단계, [도움 받기] 안내(설명은 눌러야 만듦)');
var hp = call(api_comprehensionHelp(TS, fb5.data.submissionId), 'help');
ok(hp.ok && hp.data.mode === '예시', '이해 도움(예시)');
ok(__lastReq.body.messages[1].content.some && __lastReq.body.messages[1].content.some(function (c) { return c.type === 'image_url'; }), '이해 도움 호출에 풀이 사진 포함');
__analysisQueue.push({ is_correct: false, evidence_sufficient: false, insufficient_reason: '답만 있음', errors: [] });
var fb6 = call(api_submitSolution(TS, { submissionId: fb5.data.submissionId, lines: [{ text: '7' }], notUnderstood: false }), 'submit6');
ok(fb6.ok && fb6.data.result === 'hold' && fb6.data.message === '선생님께서 답변해주실거에요.', '판단 보류 → 교사 요청');
// 근의 공식에서 a,b,c 부호를 모두 바꿔 넣어 답만 우연히 맞은 경우 → 정답 처리하지 않음
var asgL = home.data.items[2].assignmentId; call(api_openProblem(TS, asgL), 'open-l');
var trL = call(api_transcribe(TS, { assignmentId: asgL, imageBase64: img, mime: 'image/jpeg' }), 'trL');
__analysisQueue.push({ is_correct: true, process_ok: false, evidence_sufficient: true, student_final_answer: '(-3±√13)/2', line_checks: [{ line: 2, values_used: 'a=-1, b=-3, c=1', ok: false, why: '문제의 계수와 부호가 모두 다름' }],
  errors: [{ line: 2, stage: '변형', concept_id: '1011', concept_name: '근의 공식', category: '근의 공식 대입 오류', description: '최종 답은 맞지만 과정에 오류(정답 우연 일치)', confidence: 0.8 }] });
var fbL = call(api_submitSolution(TS, { submissionId: trL.data.submissionId, lines: [{ text: 'x=(3±√13)/(-2)' }] }), 'submitL');
ok(fbL.ok && fbL.data.result === 'wrong' && fbL.data.stage === '변형', '답만 맞고 과정이 틀리면 정답 아님 → 변형: ' + (fbL.data && fbL.data.result));
var asg3 = home.data.items[1].assignmentId; call(api_openProblem(TS, asg3), 'open-m');
var trM = call(api_transcribe(TS, { assignmentId: asg3, imageBase64: img, mime: 'image/jpeg' }), 'trM');
__analysisQueue.push({ is_correct: true, process_ok: false, evidence_sufficient: true, line_checks: [{ line: 2, ok: false, why: '부호 불일치' }], errors: [] });
var fbM = call(api_submitSolution(TS, { submissionId: trM.data.submissionId, lines: [{ text: 'x=(3±√13)/(-2)' }] }), 'submitM');
ok(fbM.ok && fbM.data.result === 'hold', '과정 오류인데 오류 내용이 없으면 교사 확인으로: ' + (fbM.data && fbM.data.result));

print('--- help / skip');
var asgH = home.data.items[6].assignmentId;
call(api_openProblem(TS, asgH), 'open-h');
var nLogH = __llmLog.length;
var ph = call(api_problemHelp(TS, asgH), 'problem-help');
ok(ph.ok && ph.data.explanation && __llmLog.length === nLogH + 1, '[도움 받기] 누르면 바로 AI 설명: ' + (ph.data && ph.data.title));
ok(call(api_problemHelp(TS, asgH), 'problem-help2').ok && __llmLog.length === nLogH + 1, '같은 문제 설명은 저장해 둔 것을 씀');
var nHelp = rows_(SH.HELP).length;
var sk = call(api_skipProblem(TS, asgH), 'skip');
ok(sk.ok && sk.data.view.progress.stage === 'skip' && sk.data.canNext, '이해 못 함 → 문제 넘어감(못 풂)');
var skHome = call(api_studentHome(TS), 'home-skip').data.items.filter(function (it) { return it.assignmentId === asgH; })[0];
ok(skHome.status === '못 풂', '학생 목록에 못 풂 표시');
var skReq = rows_(SH.HELP).slice(nHelp)[0];
ok(rows_(SH.HELP).length === nHelp + 1 && str_(skReq['사유']).indexOf('못 풀어요') >= 0 && str_(skReq['학생ID']) === lg.data.profile.id, '선생님께 못 푼다고 알림');
var skSub = getObj_(SH.SUBMIT, sk.data.submissionId);
ok(str_(skSub['정오']) === 'X' && str_(skSub['주원인']) === '이해' && str_(skSub['시도구분']) === '원문항', '못 푼 문제는 처음 풀이에서 틀린 것(이해 단계)으로 기록');
ok(!api_skipProblem(TS, asgH).ok && !api_problemHelp(TS, asgH).ok, '넘어간 문제는 다시 넘기거나 도움 받을 수 없음');
ok(call(api_nextAssignment(TS, asgH), 'next-skip').data.assignmentId !== asgH, '다음 문제로');

print('--- teacher views');
ok(call(api_teacherHome(TT), 'thome').data.pending >= 1, '대기 요청 수');
var hl = call(api_helpList(TT), 'helpList');
ok(hl.ok && hl.data.length >= 1, '선생님의 풀이가 필요해요 목록');
// 목록은 최신 대기 요청이 먼저라, 사진이 없는 [도움 받기]→넘어감 요청이 맨 앞일 수 있다: 사진이 있는 요청을 골라 본다.
var photoReq = hl.data.filter(function (r) { return r.reason.indexOf('못 풀어요') < 0; })[0];
var hd = call(api_helpDetail(TT, photoReq.requestId), 'helpDetail');
ok(hd.ok && hd.data.item && hd.data.image, '요청 상세(사진 포함)');
var skipReq = hl.data.filter(function (r) { return r.reason.indexOf('못 풀어요') >= 0; })[0];
var hdSkip = skipReq ? call(api_helpDetail(TT, skipReq.requestId), 'helpDetail-skip') : null;
ok(hdSkip && hdSkip.ok && hdSkip.data.item && !hdSkip.data.image && hdSkip.data.submission.notUnderstood === 'Y', '넘어간 문제 요청 상세: 문제는 보이고 사진은 없음');
ok(call(api_helpAnswer(TT, { requestId: hl.data[0].requestId, answer: '$\\sqrt{36}=6$ 이에요', stage: '처리기술', conceptId: '163' }), 'answer').ok, '교사 답변');
var pend = call(api_helpList(TT), 'helpList2').data.filter(function (r) { return r.status === '대기' && r.reason.indexOf('못 풀어요') < 0; })[0];
var pendSub = pend ? getObj_(SH.SUBMIT, str_(getObj_(SH.HELP, pend.requestId)['제출ID'])) : null;
if (pendSub) {
  call(api_helpAnswer(TT, { requestId: pend.requestId, answer: '맞게 풀었어요', stage: '정답' }), 'answer-ok');
  var tRow = sheetRows(SH.MISCON).filter(function (r) { return str_(r['출처']) === '교사판정' && miscVerdict_(r) === '이해함'; })[0];
  ok(tRow && str_(tRow['오개념 개념 코드']) === getItem_(str_(pendSub['문항ID'])).conceptId, '교사가 정답으로 판정 → 이해함');
} else ok(false, '정답 판정할 대기 요청이 없음');
var cs = call(api_classStudents(TT, '1'), 'class');
ok(cs.ok && cs.data.length === 30, '1반 학생 30명');
var bank = call(api_problemBank(TT, { grade: '중3' }), 'bank');
ok(bank.ok && bank.data.total > 300, '문항 은행: ' + (bank.data && bank.data.total));
var gen = call(api_generateForCode(TT, 'A090001001'), 'gen');
ok(gen.ok && gen.data.code === 'A090001001', '문항 생성 저장');
ok(call(api_assign(TT, { itemIds: [gen.data.id], classes: ['1', '2'] }), 'assign').ok, '출제');
var al = call(api_assignments(TT), 'assignments');
ok(al.data.length === 10, '출제 목록 10개');
ok(call(api_updateAssignment(TT, { assignmentId: al.data[9].assignmentId, action: 'up' }), 'up').ok, '순서 변경');
var mvId = al.data[0].assignmentId;
ok(call(api_updateAssignment(TT, { assignmentId: mvId, action: 'move', to: 3 }), 'move').ok && call(api_assignments(TT), 'al-move').data[3].assignmentId === mvId, '끌어다 놓기로 순서 변경(1번 → 4번 자리)');
var orders = call(api_assignments(TT), 'al-move2').data.map(function (a) { return a.order; });
ok(orders.every(function (o, k) { return o === k + 1; }), '순서는 1부터 빈틈없이 다시 매김');
ok(call(api_setAssignmentsStatus(TT, { ids: [mvId], status: 'ended' }), 'end').data === 1 && !call(api_assignments(TT), 'al-end').data.filter(function (a) { return a.assignmentId === mvId; })[0].visible, '선택한 과제를 과제 종료로');
call(api_setAssignmentsStatus(TT, { ids: [mvId], status: 'open' }), 'reopen');
call(api_updateAssignment(TT, { assignmentId: mvId, action: 'move', to: 0 }), 'move-back');
ok(call(api_resetStudent(TT, '30105'), 'reset').ok, '비밀번호 초기화');
call(api_assign(TT, { itemIds: [gen.data.id], classes: ['3'] }), 'assign-extra');
var mineA = call(api_assignments(TT), 'assign-list').data;
var otherA = rows_(SH.ASSIGN).filter(function (a) { return str_(a['교사ID']) === 'T02'; })[0];
var rm = call(api_removeAssignments(TT, { ids: mineA.filter(function (a) { return a.item && a.item.id === gen.data.id; }).map(function (a) { return a.assignmentId; }).concat([ str_(otherA['과제ID'])]) }), 'remove-many');
ok(rm.ok && rm.data === 2 && call(api_assignments(TT), 'assign-list2').data.length === mineA.length - 2 && getObj_(SH.ASSIGN, str_(otherA['과제ID'])), '여러 문제 한 번에 빼기(다른 선생님 출제는 그대로)');
ok(!api_classStudents(TT, '4').ok, '다른 선생님 반 접근 차단');

print('--- problem images');
var sampleCodes = SAMPLE_ITEMS.map(function (x) { return x.code; });
var sqCodes = (itemInfoIndex_().byConcept['5261'] || []).filter(function (c) { return sampleCodes.indexOf(c) < 0; }).slice(0, 2);
__addProblemFolder('중3_문제이미지', sampleCodes.concat(sqCodes));
var setupMsg = setupAll_();
ok(setupMsg.indexOf('문제 이미지: ' + (sampleCodes.length + sqCodes.length) + '개 연결') >= 0, '초기 설정이 문제 이미지 연결: ' + setupMsg.split('\n').filter(function (l) { return l.indexOf('문제 이미지') === 0; })[0]);
var imgItem = getItem_('IMG-A090011001');
ok(imgItem && imgItem.imageId === 'PIMG-A090011001' && !imgItem.answer && imgItem.source === '문제이미지', '이미지 문항 생성(정답은 아직 없음)');
ok(rows_(SH.ASSIGN).every(function (a) { return str_(a['문항ID']).indexOf('Q-SAMPLE-') < 0; }), '기존 샘플 출제 → 같은 코드의 이미지 문항으로 교체');
var again2 = setupAll_();
ok(again2.indexOf('새로 추가 0개') >= 0 && rows_(SH.ITEM).filter(function (r) { return str_(r['문항ID']).indexOf('IMG-') === 0; }).length === sampleCodes.length + sqCodes.length, '다시 실행해도 이미지 문항이 늘지 않음');
// 학생: 문제 이미지가 보임
var asgImg = home.data.items[8].assignmentId;
var vImg = call(api_openProblem(TS, asgImg), 'open-img');
ok(vImg.ok && vImg.data.problem.hasImage && /^data:image\/png/.test(vImg.data.problem.image || '') && !vImg.data.problem.answer, '학생 화면에 문제 이미지(정답 숨김)');
var homeImg = call(api_studentHome(TS), 'home-img');
ok(homeImg.data.items.some(function (x) { return x.preview === '(그림으로 된 문제)'; }), '목록 미리보기: 그림으로 된 문제');
// 교사: 미리보기에서 AI가 풀어 둔 정답 확인·수정
var nLog = __llmLog.length;
var det = call(api_itemDetail(TT, 'IMG-A090011001'), 'item-detail');
ok(det.ok && det.data.answer === '⑤ √42 cm' && det.data.answerCheck === '확인필요' && /^data:image/.test(det.data.image) && __llmLog.length === nLog + 1, '미리보기 때 이미지를 한 번 풀어 정답 저장(확인필요)');
call(api_itemDetail(TT, 'IMG-A090011001'), 'item-detail2');
ok(__llmLog.length === nLog + 1, '한 번 푼 문항은 다시 AI를 부르지 않음');
var sv = call(api_saveItemAnswer(TT, { itemId: 'IMG-A090011001', answer: '⑤ √42 cm' }), 'save-answer');
ok(sv.ok && getItem_('IMG-A090011001').answerCheck === '확인됨', '교사가 정답 확인 → 확인됨');
var nLog2 = __llmLog.length;
var gImg = call(api_generateForCode(TT, sqCodes[0]), 'gen-img');
ok(gImg.ok && gImg.data.id === 'IMG-' + sqCodes[0] && __llmLog.length === nLog2, '이미지가 있는 문항코드는 AI 생성 없이 그대로 출제');
var bankImg = call(api_problemBank(TT, { grade: '중3' }), 'bank-img');
ok(bankImg.data.rows.some(function (r) { return r.code === sqCodes[0] && r.imageItemId === 'IMG-' + sqCodes[0]; }), '문항 은행에 이미지 문항 표시');
// 분석: 처음 쓰는 이미지 문항은 먼저 풀고, 문제 이미지 + 학생 사진을 함께 보냄
var trImg = call(api_transcribe(TS, { assignmentId: asgImg, imageBase64: img, mime: 'image/jpeg' }), 'tr-img');
var ocrImgs = __lastReq.body.messages[1].content.filter(function (c) { return c.type === 'image_url'; }).length;
ok(ocrImgs === 2 && __lastReq.body.messages[1].content[0].text.indexOf('문제 이미지, 학생 풀이 순서로 첨부함') >= 0, '이미지 문항 전사: 문제 이미지 + 학생 풀이 2장');
__analysisQueue.push({ is_correct: false, evidence_sufficient: true, errors: [{ line: 1, stage: '처리기술', concept_id: '163', concept_name: '유리수의 덧셈', category: '부호', confidence: 0.9 }] });
var fbImg = call(api_submitSolution(TS, { submissionId: trImg.data.submissionId, lines: [{ text: '7×6=43' }] }), 'submit-img');
var lastImgs = __lastReq.body.messages[1].content.filter(function (c) { return c.type === 'image_url'; }).length;
ok(fbImg.ok && lastImgs === 2 && __lastReq.body.messages[1].content[0].text.indexOf('문제 이미지(그림·보기 포함), 학생 풀이 사진 순서로 첨부함') >= 0, '오류 분석에 문제 이미지 + 학생 사진(2장)');
var solvedItem = getItem_(vImg.data.problem.id);
ok(solvedItem.answer && solvedItem.text, '분석 전에 이미지 문항의 정답·문제 글을 채움');
// 문제 고르기: 같은 개념의 이미지 문항
var exImg = {}; exImg['IMG-A090011001'] = true;
var sim = pickSimilarForConcept_(teacherAiConfig_('T01'), '5261', 0, exImg, null);
ok(sim && sim.imageId && sim.id !== 'IMG-A090011001', '비슷한 문제: 같은 개념의 다른 이미지 문항: ' + (sim && sim.id));
var nw = pickNewForCode_(teacherAiConfig_('T01'), getItem_('IMG-A090011001'), {});
ok(nw && nw.imageId && nw.conceptId === '5261' && nw.id !== 'IMG-A090011001', '3단계 적용: 같은 개념의 다른 이미지 문항: ' + (nw && nw.id));

// 비슷한 난이도: 난이도 차이가 큰 기존 문항은 쓰지 않고 목표 난이도로 새로 만든다
var nLog3 = __llmLog.length;
var far = pickSimilarForConcept_(teacherAiConfig_('T01'), '5261', 3, {}, null);
ok(far && !far.imageId && Math.abs(far.diff - 3) <= DIFF_TOL && __llmLog.length > nLog3, '비슷한 난이도: 먼 문항 대신 난이도 ' + (far && far.diff) + ' 문항 생성');
var near = pickSimilarForConcept_(teacherAiConfig_('T01'), '5261', getItem_('IMG-A090011001').diff, exImg, null);
ok(near && Math.abs(near.diff - getItem_('IMG-A090011001').diff) <= DIFF_TOL, '비슷한 난이도: 차이 ' + (near && Math.abs(near.diff - getItem_('IMG-A090011001').diff).toFixed(2)));

print('--- report');
// 시험 자료에는 변별도가 없다: 문항정보_중3에 변별도 열을 넣고, 인수분해(A090022001)만 비워 둔다.
var info3 = ss_().getSheetByName('문항정보_중3');
var codes3 = info3.getRange(1, 1, info3.getLastRow(), 1).getValues();
info3.getRange(1, 7, codes3.length, 1).setValues(codes3.map(function (r, i) { return [i === 0 ? '변별도' : (String(r[0]) === 'A090022001' ? '' : 1 + (i % 4) * 0.5)]; }));
['itemInfo', 'infoSheets'].forEach(forget_);
// 과제를 다 하기 전에는 학생·교사 모두 리포트를 받을 수 없다
var hm = call(api_studentHome(TS), 'home-report');
ok(hm.data.report && !hm.data.report.ready && hm.data.report.total === 9, '과제 전부 마치기 전: 리포트 닫힘 (' + hm.data.report.done + '/' + hm.data.report.total + ')');
var nr = api_myReport(TS);
ok(!nr.ok && nr.code === 'NOTREADY' && nr.error.indexOf('/9') > 0, '학생 리포트 잠김: ' + nr.error);
var early = call(api_studentReport(TT, lg.data.profile.id), 'teacher-report-early');
ok(early.ok && early.data.progress && !early.data.progress.ready && early.data.items.length === early.data.correct + early.data.wrong + early.data.pending, '교사는 과제를 다 마치기 전에도 리포트 생성 (' + (early.data && early.data.progress.done) + '/' + (early.data && early.data.progress.total) + ', 문항 ' + (early.data && early.data.items.length) + ')');
ok(early.data && early.data.deficit && call(api_studentReportSummary(TT, lg.data.profile.id), 'teacher-summary-early').ok, '교사: 진행 중 리포트에도 학습 결손·AI 평가');
ok(api_myReport(TS).code === 'NOTREADY', '교사가 먼저 만들어도 학생은 과제를 다 마쳐야 볼 수 있음');
updateObj_(SH.REPORT, lg.data.profile.id, { '평가': '', '평가기준': '' }); // 아래 평가 시험을 위해 비움
var roster0 = call(api_classStudents(TT, '1'), 'roster0').data.filter(function (s) { return s.id === lg.data.profile.id; })[0];
ok(roster0 && roster0.report && !roster0.report.ready, '학급 명단에 리포트 진행 표시');
// 남은 과제를 마친 것으로 만든다(재시도 한도·선생님 확인 중도 마친 것으로 본다)
var sessS = requireStudent_(TS);
studentAssignments_(sessS).forEach(function (a) { var p = getOrCreateProgress_(sessS, a); if (!canNext_(p)) setProgress_(p, { '단계': 'done', '상태': '완료', '완료일시': now_() }); });
ok(call(api_studentHome(TS), 'home-ready').data.report.ready, '과제를 모두 마치면 리포트 열림');
var rp = call(api_myReport(TS), 'my-report');
var rpd = rp.data || { items: [] };
ok(rp.ok && rpd.items.length === rpd.correct + rpd.wrong + rpd.pending && rpd.items.length > 0, '내 리포트: 맞음 ' + rpd.correct + ' / 틀림 ' + rpd.wrong + ' / 보류 ' + rpd.pending);
var keysSeen = {};
ok(rpd.items.every(function (it) { var d = !keysSeen[it.key]; keysSeen[it.key] = 1; return d; }), '과제마다 처음 풀이 하나만');
ok(rpd.items.filter(function (it) { return it.result === 'X'; }).every(function (it) { return it.stage && it.stageExplain; }), '틀린 문제에 주원인·설명');
var ex = 0, mx = 0;
rpd.items.forEach(function (it) { if (it.result === '보류') return; mx += it.disc; if (it.result === 'O') ex += it.disc; });
ok(rpd.score.percent === (mx ? Math.round(ex * 1000 / mx) / 10 : 0), '총점 = Σ(변별도×정오)/Σ변별도×100: ' + rpd.score.percent);
ok(reportDisc_('A090011001') > 0 && reportDisc_('A090022001') === 0 && reportDisc_('없는코드') === 0, '변별도 없으면 0');
var triedNoDisc = rows_(SH.SUBMIT).some(function (s) { return str_(s['학생ID']) === lg.data.profile.id && str_(s['시도구분']) === '원문항' && str_(s['문항코드']) === 'A090022001' && ['O', 'X', '보류'].indexOf(str_(s['정오'])) >= 0; });
ok(rpd.items.every(function (it) { return it.code !== 'A090022001' && it.disc > 0; }) && (!triedNoDisc || rpd.excluded >= 1), '변별도 없는 문항은 리포트에서 제외 (제외 ' + rpd.excluded + '개, 시도함=' + triedNoDisc + ')');
var firstAsg = rpd.items[0];
var subsOfFirst = rows_(SH.SUBMIT).filter(function (s) { return str_(s['과제ID']) === firstAsg.key && str_(s['학생ID']) === lg.data.profile.id; });
ok(subsOfFirst.length >= 1 && str_(subsOfFirst[0]['정오']) === firstAsg.result, '처음 풀이의 정오 사용');
var nLog4 = __llmLog.length;
var sm = call(api_myReportSummary(TS), 'summary');
ok(sm.ok && sm.data.lines.length === 3 && __llmLog.length === nLog4 + 1, 'AI 평가 3줄');
var sm2 = call(api_myReportSummary(TS), 'summary2');
ok(sm2.ok && __llmLog.length === nLog4 + 1 && sm2.data.lines[0] === sm.data.lines[0], '기록이 그대로면 저장한 평가 재사용');
ok(call(api_studentReportSummary(TT, lg.data.profile.id), 'summary-teacher').ok && __llmLog.length === nLog4 + 1, '교사도 저장한 평가를 그대로 봄');
// 채점 결과만 바뀌면(선생님 판정 등) 평가는 그대로, 새로 푼 문제가 생기면 다시 씀
var repRow = getObj_(SH.REPORT, lg.data.profile.id);
updateObj_(SH.REPORT, repRow._row, { '기준': 'changed' });
ok(call(api_myReportSummary(TS), 'summary-same-items').ok && __llmLog.length === nLog4 + 1, '푼 문제가 같으면 리포트를 다시 만들어도 평가는 다시 쓰지 않음');
updateObj_(SH.REPORT, repRow._row, { '기준': 'changed', '평가기준': 'old-items' });
ok(call(api_myReportSummary(TS), 'summary-new-items').ok && __llmLog.length === nLog4 + 2, '새로 푼 문제가 생기면 평가를 다시 씀');
var pv = call(api_reportProblem(TS, firstAsg.itemId), 'report-problem');
ok(pv.ok && pv.data.id === firstAsg.itemId && pv.data.answer === undefined, '리포트에서 문제 보기(정답 제외)');
ok(!api_reportProblem(TS, 'IMG-A090062001').ok || rpd.items.some(function (it) { return it.itemId === 'IMG-A090062001'; }), '안 푼 문제는 볼 수 없음');
ok(!api_myReport('bad-token').ok, '로그인 없이 리포트 불가');
// 학습 결손: 교사 리포트에만
ok(rpd.deficit === undefined && JSON.stringify(rp.data).indexOf('학습 결손') < 0, '학생 리포트에는 학습 결손 없음');
var tr1 = call(api_studentReport(TT, lg.data.profile.id), 'teacher-report');
var dfc = tr1.data.deficit || {};
var expRank = rpd.correct + rpd.wrong < 3 ? -1 : (rpd.score.percent < 20 ? 3 : rpd.score.percent < 30 ? 2 : rpd.score.percent < 40 ? 1 : 0);
ok(tr1.ok && dfc.rank === expRank && tr1.data.createdAt === rp.data.createdAt && tr1.data.summary.lines.length === 3, '교사 리포트: 같은 리포트 + 학습 결손 ' + dfc.label + ' (총점 ' + rpd.score.percent + ')');
ok(deficitLevel_({ correct: 9, wrong: 1, score: { percent: 90 } }).label === '해당 없음' && deficitLevel_({ correct: 3, wrong: 7, score: { percent: 35 } }).label === '학습 결손 주의' &&
  deficitLevel_({ correct: 2, wrong: 8, score: { percent: 25 } }).label === '학습 결손 심함' && deficitLevel_({ correct: 1, wrong: 9, score: { percent: 10 } }).label === '학습 결손 매우 심함' &&
  deficitLevel_({ correct: 1, wrong: 1, score: { percent: 10 } }).rank === -1, '학습 결손 3단계(40/30/20점 미만) + 평범한 학생 해당 없음 + 문제 적으면 판단 보류');
var nLog5 = __llmLog.length;
ok(call(api_myReport(TS), 'my-report-again').data.summary.lines.length === 3 && __llmLog.length === nLog5, '만들어 둔 리포트(평가 포함)를 그대로 다시 봄');
var saved = getObj_(SH.REPORT, lg.data.profile.id);
ok(saved && parseJson_(saved['리포트'], null) && parseJson_(saved['학습결손'], null).rank === expRank, '학습리포트 시트에 리포트·학습결손 저장');

// 오개념 지도: 오개념도표 누적 횟수 + 선수개념위계도로 연결(중간 개념은 연결 개념)
var mg0 = rp.data.misGraph;
var myMis = rows_(SH.MISCON).filter(function (r) { return str_(r['학생id']) === lg.data.profile.id && miscVerdict_(r) === '오개념'; });
ok(rows_(SH.MISCON).some(function (r) { return str_(r['학생id']) === lg.data.profile.id && miscVerdict_(r) === '이해함'; }), '오개념 지도는 이해함 행을 세지 않음(이해함 행이 있어도)');
ok(mg0 && mg0.total === Object.keys(myMis.reduce(function (o, r) { o[str_(r['오개념 개념 코드'])] = 1; return o; }, {})).length, '오개념 지도: 확인된 오개념 ' + (mg0 && mg0.total) + '개');
var pmT = prereqMap_().pre, chainX = null;
Object.keys(pmT).some(function (x) {
  return (pmT[x] || []).some(function (p) { return (pmT[p] || []).some(function (q) { if (q !== x && (pmT[x] || []).indexOf(q) < 0) { chainX = [q, p, x]; return true; } return false; }); });
});
var dirY = Object.keys(pmT).filter(function (y) { return chainX && chainX.indexOf(y) < 0 && pmT[y].some(function (z) { return chainX.indexOf(z) < 0; }); })[0];
var dirZ = dirY ? pmT[dirY].filter(function (z) { return chainX.indexOf(z) < 0; })[0] : null;
var stRef = { id: lg.data.profile.id, name: '시험' };
bumpMiscon_(stRef, [chainX[2]]); bumpMiscon_(stRef, [chainX[2]]); bumpMiscon_(stRef, [chainX[2]]); bumpMiscon_(stRef, [chainX[0]]);
bumpMiscon_(stRef, [dirY, dirZ]); bumpMiscon_(stRef, [dirY]);
var mg = misconceptionGraph_(lg.data.profile.id);
var nodeOf = function (id) { return mg.nodes.filter(function (n) { return n.id === String(id); })[0]; };
var hasEdge = function (a, b) { return mg.edges.some(function (e) { return e.from === String(a) && e.to === String(b); }); };
ok(nodeOf(chainX[2]) && nodeOf(chainX[2]).count >= 3 && nodeOf(chainX[0]) && !nodeOf(chainX[0]).bridge, '누적 횟수: ' + nodeOf(chainX[2]).name + ' ' + nodeOf(chainX[2]).count + '회');
ok(nodeOf(chainX[1]) && nodeOf(chainX[1]).bridge === !myMis.some(function (r) { return str_(r['오개념 개념 코드']) === String(chainX[1]); }) && hasEdge(chainX[0], chainX[1]) && hasEdge(chainX[1], chainX[2]), '2단계 위 선수 오개념은 중간 개념을 거쳐 이어짐: ' + chainX.join('→'));
ok(hasEdge(dirZ, dirY) && mg.edges.filter(function (e) { return e.from === String(dirZ) && e.to === String(dirY); })[0].direct, '바로 선수 관계는 직접 간선: ' + dirZ + '→' + dirY);
ok(mg.nodes.filter(function (n) { return !n.bridge; }).length <= 16 && mg.nodes.filter(function (n) { return n.bridge; }).length <= 12, '노드 수 제한');
ok(call(api_studentReport(TT, lg.data.profile.id), 'teacher-report-graph').data.misGraph.total === mg.total, '교사 리포트에도 오개념 지도');
rebuildScores_(); // 시험용으로 넣은 오개념도표 행을 오류기록 기준으로 되돌림

print('--- class report');
var cr = call(api_classReport(TT, '1'), 'class-report');
var crd = cr.data || { students: [], summary: { deficit: {} } };
var cnt = crd.students.filter(function (s) { return s.deficit.rank > 0; }).length;
ok(cr.ok && crd.students.length === rows_(SH.STUDENT).filter(function (s) { return str_(s['반']) === '1'; }).length && crd.summary.deficit.total === cnt, '학급 리포트: 학생 ' + crd.students.length + '명, 결손 의심 ' + cnt + '명');
var meRow = crd.students.filter(function (s) { return s.id === lg.data.profile.id; })[0];
ok(meRow && meRow.progress.ready && meRow.rate === Math.round(rpd.correct * 1000 / (rpd.correct + rpd.wrong)) / 10 && meRow.deficit.rank === expRank, '학급 리포트의 학생 행: 진행 ' + meRow.progress.done + '/' + meRow.progress.total + ', 정답률 ' + meRow.rate + '%');
ok(!api_classReport(TS, '1').ok, '학생은 학급 리포트 불가');

print('--- data view');
var dt = call(api_dataTables(TT), 'data-tables');
var names = dt.data.sheets.map(function (s) { return s.name; });
ok(dt.ok && names.indexOf(SH.SUBMIT) >= 0 && names.indexOf('문항정보_중3') >= 0 && names.indexOf(SH.REPORT) >= 0, '데이터 보기: 시트 ' + names.length + '개');
ok(!api_dataTables(TS).ok, '학생은 데이터 보기 불가');
var dTeacher = call(api_dataRows(TT, { kind: 'sheet', name: SH.TEACHER }), 'data-teacher');
var hashCol = dTeacher.data.columns.indexOf('비밀번호해시');
ok(hashCol >= 0 && dTeacher.data.rows.every(function (r) { return r.cells[hashCol] === '(숨김)'; }), '비밀번호 해시는 가림');
ok(call(api_dataCell(TT, { name: SH.TEACHER, row: 2, col: hashCol }), 'cell-hidden').data === '(숨김)', '가린 칸은 전체 보기도 가림');
var dInfo = call(api_dataRows(TT, { kind: 'sheet', name: '문항정보_중3', offset: 50, limit: 50 }), 'data-page');
ok(dInfo.data.rows.length === 50 && dInfo.data.total === 431 && dInfo.data.rows[0].n === 52, '쪽 나누기(50행)');
ok(call(api_dataRows(TT, { kind: 'sheet', name: SH.STUDENT, q: '테스트학생' }), 'data-q').data.total === 1, '검색');
var dSub = call(api_dataRows(TT, { kind: 'sheet', name: SH.SUBMIT, q: lg.data.profile.id }), 'data-sub');
var aiCol = dSub.data.columns.indexOf('AI분석'), longRow = dSub.data.rows.filter(function (r) { return r.cells[aiCol] && r.cells[aiCol].more; })[0];
ok(longRow && call(api_dataCell(TT, { name: SH.SUBMIT, row: longRow.n, col: aiCol }), 'data-cell').data.length === longRow.cells[aiCol].more, '긴 칸은 잘라 보내고 눌러서 전체 보기');
if (typeof DbView !== 'undefined') {
  var sys = dt.data.tables.map(function (t) { return t.name; });
  ok(['gas_props', 'gas_cache', 'gas_files', 'gas_locks', 'gas_folders', 'gas_sheets'].every(function (n) { return sys.indexOf(n) >= 0; }), '시스템 표 ' + sys.length + '개');
  var props = JSON.stringify(call(api_dataRows(TT, { kind: 'table', name: 'gas_props' }), 'data-props').data);
  ok(props.indexOf('APIKEY_T01') >= 0 && props.indexOf('sk-test') < 0 && props.indexOf(PropertiesService.getScriptProperties().getProperty('PEPPER')) < 0, 'API 키·PEPPER 값은 가림');
  var cacheTbl = JSON.stringify(call(api_dataRows(TT, { kind: 'table', name: 'gas_cache' }), 'data-cache').data);
  ok(cacheTbl.indexOf(TS) < 0 && cacheTbl.indexOf(TT) < 0, '로그인 세션 토큰은 가림');
  ok(call(api_dataRows(TT, { kind: 'table', name: 'gas_props', q: 'sk-test' }), 'data-props-q').data.total === 0, '가린 값으로는 검색 안 됨');
  ok(!api_dataRows(TT, { kind: 'table', name: 'pg_user' }).ok, '정해진 표만 읽음');
}

print('--- analysis input');
var df = diffLines_([{ text: 'a=1' }, { text: 'b=2' }, { text: 'c=3' }], [{ text: 'a = 1' }, { text: 'b=5' }, { text: 'c=3' }, { text: 'd=4' }]);
ok(df.length === 2 && df[0].type === '수정' && df[0].line === 2 && df[0].from === 'b=2' && df[0].to === 'b=5' && df[1].type === '추가' && df[1].line === 4, '고친 줄 비교: 수정·추가 (공백 차이는 무시)');
var df2 = diffLines_([{ text: 'x' }, { text: 'y' }, { text: 'z' }], [{ text: 'x' }, { text: 'z' }]);
ok(df2.length === 1 && df2[0].type === '삭제' && df2[0].from === 'y' && df2[0].line === 2, '고친 줄 비교: 삭제');
ok(diffLines_([{ text: 'x' }], [{ text: 'x' }]).length === 0, '고친 줄 없음');
var aCtx = buildAnalysisContext_(getItem_('Q-SAMPLE-04'), [{ text: 'x^2-x-12=0' }, { text: '(x-3)(x+4)=0' }], [{ text: 'x^2-x-12=0' }, { text: '(x+3)(x-4)=0' }]);
var aUser = promptAnalysisUser_(aCtx);
ok(aUser.indexOf('[학생이 고친 부분]') >= 0 && aUser.indexOf('2번째 줄 수정: "(x-3)(x+4)=0" → "(x+3)(x-4)=0"') >= 0, '분석 입력에 학생이 고친 부분');
var aSys = promptAnalysisSystem_();
ok(['1단계. 학생의 생각 읽기', '2단계. 줄 단위 검증', '3단계. 잘못된 부분 모두 찾기', '4단계. 이해 수준', '5단계. 오개념 나열', '"전략을 고른 줄" 하나로', '순열 대신 조합', '값을 잘못 대입', '"절차적 이해": 공식·절차는 맞게'].every(function (k) { return aSys.indexOf(k) >= 0; }), '분석 지침: 지침 순서·전략 오류 규칙·이해 수준 정의');
var cOut = decideOutcome_({ is_correct: false, evidence_sufficient: true, errors: [{ line: 2, stage: '변형', concept_id: '9832', confidence: 0.9 }],
  misconceptions: [{ concept_id: '10169', concept_name: '인수분해', kind: '적용', confidence: 0.3, understanding_level: '부분 이해', student_belief: 'b' }, { concept_id: '9832', kind: '전략 선택', confidence: 0.85, understanding_level: '절차적 이해' }] }, aCtx);
ok(cOut.candidates.length === 2 && cOut.candidates[0].conceptId === '9832' && cOut.candidates[0].kind === '전략 선택' && cOut.candidates[1].confidence === 0.3 && cOut.candidates[1].level === '부분 이해', '오개념 후보: 확신도 순·종류·이해 수준');
ok(cOut.misconceptions.indexOf('9832') === 0 && cOut.misconceptions.indexOf('10169') < 0, '확신도 기준 미만 후보는 유도질문 시작 개념에서 빼고 후보로만 남김');
ok(decideOutcome_({ is_correct: true, misconceptions: [{ concept_id: '10169', confidence: 0.9 }] }, aCtx).candidates.length === 0, '정답이면 오개념 후보 없음');

print('--- preview');
var pv1 = previewText_('다음 그림의 원기둥과 원뿔의 부피가 서로 같을 때, 원기둥의 높이를 구하시오. [그림] 반지름이 $\\sqrt{3}$ cm인 원', 60);
ok(pv1.indexOf('$\\sqrt{3}$') > 0 && (pv1.split('$').length - 1) % 2 === 0 && /…$/.test(pv1), '수식 가운데서 자르지 않음: ' + pv1);
var pv2 = previewText_('이차함수 $y=-2(x-4)^2+5$의 그래프를 평행이동하면 이차함수 $y=-2(x-3)^2+1$의 그래프와 겹친다. 이때 $a+b$의 값은?', 70);
ok((pv2.split('$').length - 1) % 2 === 0, '열린 수식은 닫히는 곳까지 또는 수식 앞에서 자름: ' + pv2);
ok(previewText_('짧은 글 $x$', 80) === '짧은 글 $x$', '짧으면 그대로');
ok(previewText_('가격은 \\$3 이고 길이는 아주 아주 아주 아주 아주 긴 문장이 이어집니다 정말로 그렇습니다', 20).length <= 21, '\\$는 수식 표시로 세지 않음');

print('--- concept log rebuild');
var tutorOk = sheetRows(SH.MISCON).filter(function (r) { return str_(r['출처']) === '유도질문' && miscVerdict_(r) === '이해함'; }).length;
var subOk = rows_(SH.SUBMIT).filter(function (r) { return str_(r['정오']) === 'O' && str_(r['개념id']); }).length;
rebuildScores_();
var after = sheetRows(SH.MISCON);
ok(after.filter(function (r) { return str_(r['출처']) === '유도질문' && miscVerdict_(r) === '이해함'; }).length === tutorOk && tutorOk >= 2, '다시 계산: 유도질문 이해함 행 유지 (' + tutorOk + '행)');
ok(after.filter(function (r) { return miscVerdict_(r) === '이해함' && str_(r['출처']) !== '유도질문'; }).length === subOk && after.every(function (r) { return str_(r['판단']) && str_(r['출처']); }), '다시 계산: 정답 → 이해함 ' + subOk + '행, 모든 행에 판단·출처');

print('--- demo');
var nReal = sheetRows(SH.MISCON).length;
print('  ' + createDemoData_().split('\n')[0]);
var demoSt = rows_(SH.STUDENT).filter(function (s) { return str_(s['반']) === '1' && str_(s['가상여부']) === 'Y'; })[0];
var demoRep = call(api_studentReport(TT, str_(demoSt['학생ID'])), 'demo-teacher-report');
ok(demoRep.ok && !demoRep.data.progress.ready && demoRep.data.items.length > 0, '가상 학생도 교사는 리포트 생성(과제 진행 ' + (demoRep.data && demoRep.data.progress.done) + '/' + (demoRep.data && demoRep.data.progress.total) + ')');
var dr = { ok: true, data: reportData_(demoSt) };
ok(dr.ok && dr.data.items.length > 0 && dr.data.items.every(function (it) { return it.key.indexOf('Q:') === 0; }), '가상 학생 리포트(과제 없는 기록은 문항별): ' + (dr.data && dr.data.items.length) + '문항');
ok(dr.data.items.filter(function (it) { return it.result === 'X' && (it.stage === '변형' || it.stage === '이해'); }).every(function (it) { return it.misconceptions.length > 0; }), '변형·이해 오답에 오개념 표시');
var otherCls = rows_(SH.STUDENT).filter(function (s) { return str_(s['반']) === '5'; })[0];
var crDemo = call(api_classReport(TT, '1'), 'class-demo').data;
ok(crDemo.summary.rate !== null && crDemo.summary.deficit.total > 0, '가상 기록 포함 학급 리포트: 정답률 ' + crDemo.summary.rate + '%, 결손 의심 ' + crDemo.summary.deficit.total + '명 (매우 심함 ' + crDemo.summary.deficit.severe + ', 심함 ' + crDemo.summary.deficit.serious + ', 주의 ' + crDemo.summary.deficit.caution + ')');
ok(!api_studentReport(TT, str_(otherCls['학생ID'])).ok || (call(api_teacherHome(TT), 'th').data.profile.classes || []).indexOf('5') >= 0, '담당 반이 아니면 리포트 불가');
var nMis = sheetRows(SH.MISCON).length;
ok(nMis > 100, '가상 로그 후 오개념도표 ' + nMis + '행');
print('  ' + clearDemoData_().split('\n')[0]);
ok(sheetRows(SH.MISCON).length === nReal, '가상 로그 정리 후 실제 기록만 남음: ' + sheetRows(SH.MISCON).length + '/' + nReal);
print(fails ? '\n실패 ' + fails + '건' : '\n모두 통과');
