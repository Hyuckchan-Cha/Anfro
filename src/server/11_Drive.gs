/* ===================== 풀이 사진 (Google Drive, 비공개) ===================== */

function imageFolder_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('IMG_FOLDER') || setting_('이미지폴더ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* 새로 만듦 */ }
  }
  var f = DriveApp.createFolder('수학오개념진단_풀이이미지(비공개)');
  try { f.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch (e) { /* 도메인 정책상 불가하면 기본(비공개) 유지 */ }
  props.setProperty('IMG_FOLDER', f.getId());
  try { setSetting_('이미지폴더ID', f.getId()); } catch (e) { /* 무시 */ }
  return f;
}

function classFolder_(cls) {
  var root = imageFolder_();
  var name = classLabel_(cls);
  var it = root.getFoldersByName(name);
  return it.hasNext() ? it.next() : root.createFolder(name);
}

/** 파일 이름에는 이름 대신 학번만 쓴다 */
function saveImage_(st, item, b64, mime) {
  var ext = mime === 'image/png' ? 'png' : (mime === 'image/webp' ? 'webp' : 'jpg');
  var name = st.id + '_' + item.id + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.' + ext;
  var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
  var file = classFolder_(st.cls).createFile(blob);
  return { id: file.getId(), url: file.getUrl() };
}

/** 제출에 연결된 풀이 사진을 AI 호출용으로 읽는다. 없으면 빈 배열. */
function submissionImages_(sub) {
  var fileId = sub ? str_(sub['이미지파일ID']) : '';
  if (!fileId) return [];
  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    return [{ mime: blob.getContentType() || 'image/jpeg', base64: Utilities.base64Encode(blob.getBytes()) }];
  } catch (e) {
    return [];
  }
}

/** 비공개 파일을 권한 확인 뒤 서버에서 읽어 화면에 보낸다 */
function imageDataUrl_(fileId) {
  if (!fileId) return null;
  try {
    var blob = DriveApp.getFileById(fileId).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    return null;
  }
}
