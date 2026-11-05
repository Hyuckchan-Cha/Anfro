/* ===================== 웹앱 시작점·스프레드시트 메뉴 ===================== */

function doGet(e) {
  var t = HtmlService.createTemplateFromFile('Index');
  t.boot = JSON.stringify(bootConfig_()).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function bootConfig_() {
  try {
    return { appName: APP_NAME, school: setting_('학교명'), grade: setting_('학년') || '3', classes: classList_(), version: APP_VERSION, ready: !!sheet_(SH.STUDENT, true) };
  } catch (e) {
    return { appName: APP_NAME, school: '', grade: '3', classes: ['1', '2', '3', '4', '5'], version: APP_VERSION, ready: false };
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('오개념진단')
    .addItem('① 초기 설정 (시트·교사·학생 명단·문제 이미지 연결)', 'menuSetup')
    .addItem('② 가상 학습 로그 만들기 (시연용)', 'menuDemo')
    .addItem('문제 정답 미리 만들기 (이미지 문항)', 'menuSolveImages')
    .addSeparator()
    .addItem('가상 학습 로그 지우기', 'menuClearDemo')
    .addItem('점수 다시 계산 (오개념도표·단계별집계)', 'menuRebuild')
    .addItem('웹앱 주소 보기', 'menuShowUrl')
    .addToUi();
}

function menuSetup() {
  var ui = SpreadsheetApp.getUi();
  try { ui.alert('초기 설정 완료', setupAll_(), ui.ButtonSet.OK); } catch (e) { ui.alert('초기 설정 오류', String(e.message || e), ui.ButtonSet.OK); }
}
function menuSolveImages() {
  var ui = SpreadsheetApp.getUi();
  try { ui.alert('문제 정답 미리 만들기', solveImagesBatch_(), ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
function menuDemo() {
  var ui = SpreadsheetApp.getUi();
  try { ui.alert('가상 학습 로그', createDemoData_(), ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
function menuClearDemo() {
  var ui = SpreadsheetApp.getUi();
  if (ui.alert('가상 학습 로그 지우기', '가상여부=Y 인 풀이·오류 기록과 가상 교사확인요청을 지우고 점수를 다시 계산할까요?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  try { ui.alert('완료', clearDemoData_(), ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
function menuRebuild() {
  var ui = SpreadsheetApp.getUi();
  try { rebuildScores_(); ui.alert('완료', '오개념도표와 단계별집계를 기록으로부터 다시 계산했어요.', ui.ButtonSet.OK); } catch (e) { ui.alert('오류', String(e.message || e), ui.ButtonSet.OK); }
}
function menuShowUrl() {
  var ui = SpreadsheetApp.getUi();
  var url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) { url = ''; }
  ui.alert('웹앱 주소', url ? url + '\n\n이 주소를 학생에게 공유하세요.' : '아직 배포하지 않았어요. Apps Script 편집기에서 [배포 > 새 배포 > 웹 앱]으로 배포해 주세요.', ui.ButtonSet.OK);
}
