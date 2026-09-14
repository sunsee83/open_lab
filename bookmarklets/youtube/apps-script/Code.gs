/*
유튜브다운로드 · Google Apps Script 고정 로더

이 파일만 Google Apps Script 프로젝트 `유튜브다운로드앱_v1`에 유지합니다.
일반 기능 수정은 Google에서 하지 않고 GitHub에서 합니다.

프로젝트 정보 원본:
https://github.com/sunsee83/open_lab/blob/main/bookmarklets/youtube/PROJECT_INFO.json

GitHub 원본 코드:
https://github.com/sunsee83/open_lab/tree/main/bookmarklets/youtube
*/

const YTDL_REMOTE_ = Object.freeze({
  BASE: 'https://raw.githubusercontent.com/sunsee83/open_lab/main/bookmarklets/youtube/',
  BACKEND: 'apps-script/runtime/Backend.gs',
  TRANSPORT: 'apps-script/runtime/Transport.gs',
  UI: 'ui.html',
  INFO: 'PROJECT_INFO.json',
  REPO: 'https://github.com/sunsee83/open_lab/tree/main/bookmarklets/youtube'
});

/*
Apps Script는 정적 소스에서 OAuth 범위를 추론합니다.
실제 Sheets 코드는 GitHub에서 런타임에 로드되므로 이 함수가 Spreadsheet 권한을
Google 승인 화면에 포함시키는 고정 힌트 역할을 합니다. 실행용 함수가 아닙니다.
*/
function ytOAuthScopeAnchor_() {
  SpreadsheetApp.openById('scope-detection-only');
}

function doGet(e) {
  const mode = String(e && e.parameter && e.parameter.mode || '');
  if (!mode || mode === 'info') return ytInfoOutput_(mode === '');
  try {
    return ytRuntime_().doGet(e);
  } catch (err) {
    return ytFallbackOutput_('GitHub 런타임을 불러오지 못했습니다.', err);
  }
}

function dispatch(request) {
  if (request && request.action === 'project-info') {
    try { return { ok: true, data: ytProjectInfo_() }; }
    catch (err) { return ytLoaderError_('PROJECT_INFO_FAILED', '프로젝트 정보를 불러오지 못했습니다.', err); }
  }
  try {
    return ytRuntime_().dispatch(request);
  } catch (err) {
    return ytLoaderError_('REMOTE_RUNTIME_FAILED', 'GitHub 런타임을 실행하지 못했습니다.', err);
  }
}

function ytRuntime_() {
  const paths = [YTDL_REMOTE_.BACKEND, YTDL_REMOTE_.TRANSPORT];
  const responses = UrlFetchApp.fetchAll(paths.map(function (path) {
    return { url: ytRemoteUrl_(path), muteHttpExceptions: true, followRedirects: true };
  }));
  const sources = responses.map(function (response, i) {
    const code = response.getResponseCode();
    if (code < 200 || code >= 300) throw new Error(paths[i] + ' HTTP ' + code);
    return response.getContentText('UTF-8');
  });
  return eval('(function(){\n' + sources.join('\n') + '\nreturn {doGet:doGet,dispatch:dispatch};\n})()');
}

function ytRemoteText_(path) {
  const allowed = [YTDL_REMOTE_.UI, YTDL_REMOTE_.INFO];
  if (allowed.indexOf(path) < 0) throw new Error('허용되지 않은 원격 파일입니다.');
  const response = UrlFetchApp.fetch(ytRemoteUrl_(path), { muteHttpExceptions: true, followRedirects: true });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(path + ' HTTP ' + code);
  return response.getContentText('UTF-8');
}

function ytRemoteUrl_(path) {
  return YTDL_REMOTE_.BASE + path + '?v=' + Date.now();
}

function ytProjectInfo_() {
  return JSON.parse(ytRemoteText_(YTDL_REMOTE_.INFO));
}

function ytInfoOutput_(approvalReturn) {
  try {
    const info = ytProjectInfo_();
    const quick = Array.isArray(info.quickView) ? info.quickView : [];
    const links = info.urls || {};
    const notice = approvalReturn
      ? '<div class="notice">Google 승인 후 이 화면으로 돌아왔다면 탭을 닫고 YouTube에서 <b>유튜브다운로드</b>를 다시 실행하세요.</div>'
      : '';
    const items = quick.map(function (x) { return '<li>' + ytHtml_(x) + '</li>'; }).join('');
    const repo = links.repository || YTDL_REMOTE_.REPO;
    return HtmlService.createHtmlOutput(
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>body{margin:0;background:#111;color:#eee;font:15px/1.55 system-ui;padding:24px}.box{max-width:680px;margin:auto;padding:20px;border:1px solid #333;border-radius:14px;background:#181818}h1{font-size:20px;margin:0 0 12px}.notice{padding:10px 12px;margin:0 0 14px;border-radius:10px;background:#262015}li{margin:7px 0}a{color:#9ecbff;word-break:break-all}.sub{color:#aaa;font-size:13px;margin-top:14px}</style></head><body><div class="box">' +
      '<h1>' + ytHtml_(info.project && info.project.name || '유튜브다운로드') + '</h1>' + notice +
      '<div>' + ytHtml_(info.project && info.project.summary || '') + '</div><ul>' + items + '</ul>' +
      '<div><a href="' + ytAttr_(repo) + '" target="_blank">GitHub 프로젝트 열기</a></div>' +
      '<div class="sub">이 Apps Script는 고정 로더입니다. 일반 기능 코드는 GitHub가 원본입니다.</div>' +
      '</div></body></html>'
    ).setTitle('유튜브다운로드 - 프로젝트 정보');
  } catch (err) {
    return ytFallbackOutput_('프로젝트 정보를 불러오지 못했습니다.', err);
  }
}

function ytFallbackOutput_(message, err) {
  return HtmlService.createHtmlOutput(
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;background:#111;color:#eee;font:15px/1.55 system-ui;padding:24px}.box{max-width:680px;margin:auto;padding:20px;border:1px solid #333;border-radius:14px;background:#181818}a{color:#9ecbff;word-break:break-all}.sub{color:#aaa;font-size:13px;margin-top:10px}</style></head><body><div class="box">' +
    '<b>유튜브다운로드</b><div style="margin-top:10px">' + ytHtml_(message) + '</div>' +
    '<div class="sub">' + ytHtml_(err && err.message || '') + '</div>' +
    '<div style="margin-top:12px"><a href="' + ytAttr_(YTDL_REMOTE_.REPO) + '" target="_blank">GitHub 프로젝트 열기</a></div>' +
    '</div></body></html>'
  ).setTitle('유튜브다운로드');
}

function ytLoaderError_(code, message, err) {
  return { ok: false, error: { code: code, message: message, detail: String(err && err.message || '') } };
}

function ytHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function ytAttr_(value) { return ytHtml_(value); }
