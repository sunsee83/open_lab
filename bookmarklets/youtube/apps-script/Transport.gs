/* 유튜브다운로드 - top-level Apps Script bridge */

function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};
  const origin = allowedOrigin_(p.origin);
  const token = sessionToken_(p.token);
  const requestId = bridgeRequestId_(p.requestId);
  const mode = String(p.mode || '');

  if (mode === 'bridge') {
    if (!origin || !token || !requestId) {
      return HtmlService.createHtmlOutput(bridgePageErrorHtml_('연결 정보가 올바르지 않습니다.'))
        .setTitle('유튜브다운로드 - Google 연결')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    try {
      return HtmlService.createHtmlOutput(bridgeTopHtml_(origin, token))
        .setTitle('유튜브다운로드 - Google 연결')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(bridgePageErrorHtml_('유튜브다운로드 연결 페이지를 만들지 못했습니다.'))
        .setTitle('유튜브다운로드 - Google 연결')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  return HtmlService.createHtmlOutput(bridgePageErrorHtml_('지원하지 않는 연결 요청입니다. YouTube에서 유튜브다운로드를 다시 실행해 주세요.'))
    .setTitle('유튜브다운로드 - Google 연결')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function bridgeTopHtml_(origin, token) {
  const ui = HtmlService.createHtmlOutputFromFile('ui').getContent();
  const o = jsLiteral_(origin);
  const t = jsLiteral_(token);
  const h = jsLiteral_(ui);
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;background:#111;color:#eee;font:15px/1.5 system-ui;padding:24px}.box{max-width:520px;margin:auto;padding:18px;border:1px solid #333;border-radius:14px;background:#181818}.sub{margin-top:8px;color:#aaa;font-size:13px}</style>' +
    '</head><body><div class="box"><b>유튜브다운로드 · Google 연결</b><div id="s" class="sub">YouTube와 연결 중…</div></div>' +
    '<script>(function(){"use strict";const O=' + o + ',T=' + t + ',H=' + h + ',S=document.getElementById("s"),OP=(function(){try{return window.top.opener}catch(e){return null}})();' +
    'function post(m){try{if(OP&&!OP.closed)OP.postMessage(m,O)}catch(e){}}' +
    'window.addEventListener("message",function(e){if(e.source!==OP||e.origin!==O)return;const m=e.data;if(!m||m.token!==T)return;' +
    'if(m.type==="YTDL_BRIDGE_CLOSE"){try{window.top.close()}catch(x){}return}' +
    'if(m.type!=="YTDL_BRIDGE_REQUEST"||typeof m.id!=="string")return;' +
    'google.script.run.withSuccessHandler(function(r){if(r&&r.ok)post({type:"YTDL_BRIDGE_RESPONSE",token:T,id:m.id,ok:true,data:r.data});else post({type:"YTDL_BRIDGE_RESPONSE",token:T,id:m.id,ok:false,error:r&&r.error||{message:"Google 요청 실패"}})}).withFailureHandler(function(x){post({type:"YTDL_BRIDGE_RESPONSE",token:T,id:m.id,ok:false,error:{message:x&&x.message||"Google 요청 실패"}})}).bridgeTopDispatch(m.request);' +
    '});' +
    'if(!OP){S.textContent="YouTube 연결 창을 찾지 못했습니다. 이 탭을 닫고 YouTube에서 다시 실행해 주세요.";return}' +
    'post({type:"YTDL_BRIDGE_READY",token:T,html:H});S.textContent="연결 완료 · YouTube 화면으로 돌아가세요.";try{OP.focus()}catch(e){}' +
    '})();<\/script></body></html>';
}

function bridgeTopDispatch(request) {
  try {
    const raw = JSON.stringify(request || {});
    if (!raw || raw.length > APP_.MAX_REQUEST_CHARS) {
      return bridgeError_('REQUEST_TOO_LARGE', '데이터가 너무 큽니다.');
    }
    return bridgeDispatch_(request);
  } catch (err) {
    return bridgeError_('INVALID_REQUEST', '요청 형식이 올바르지 않습니다.');
  }
}

function bridgeDispatch_(request) {
  if (request && request.action === 'get-ui') {
    try {
      return ok_({ html: HtmlService.createHtmlOutputFromFile('ui').getContent() });
    } catch (err) {
      return bridgeError_('UI_MISSING', 'Apps Script에 ui.html 파일이 없습니다.');
    }
  }

  if (request && request.action === 'create-storage') {
    try {
      const payload = plain_(request.payload) ? request.payload : {};
      return ok_(bridgeCreateStorage_(payload));
    } catch (err) {
      if (err && err.ytCode) return errorResult_(err);
      return bridgeError_('FILE_CREATE_FAILED', 'Google Sheets 파일을 자동으로 만들 수 없습니다.');
    }
  }

  return dispatch(request);
}

function bridgeCreateStorage_(p) {
  const state = loadState_();
  const fileName = trim_(p.fileName || '유튜브다운로드sheet_v1', 120) || '유튜브다운로드sheet_v1';
  const sheetName = dataSheetName_(p.sheetName || '수집');
  const category = trim_(p.category || '기본', 60) || '기본';

  if (state.files.length) {
    const fileId = state.defaultFileId || state.files[0].id;
    try {
      const ss = SpreadsheetApp.openById(fileId);
      if (ss.getName() === 'YouTube 수집' && fileName === '유튜브다운로드sheet_v1') ss.rename(fileName);
      refreshFileName_(fileId, ss.getName());
    } catch (err) {}
    return { created: false, state: publicState_() };
  }

  let ss;
  try {
    ss = SpreadsheetApp.create(fileName);
    const first = ss.getSheets()[0];
    first.setName(sheetName);
    initDataSheet_(first);
  } catch (err) {
    return bridgeCreateStorageFail_();
  }

  const connected = connectFile_({ sheetUrl: ss.getUrl() });
  ensureCategoryGroup_(connected.file.id, sheetName);
  const categories = addCategory_({
    fileId: connected.file.id,
    sheetName: sheetName,
    category: category
  }).categories;

  return {
    created: true,
    file: connected.file,
    sheets: connected.sheets,
    sheetName: sheetName,
    categories: categories,
    state: publicState_()
  };
}

function bridgeCreateStorageFail_() {
  const e = new Error('Google Sheets 파일을 자동으로 만들 수 없습니다.');
  e.ytCode = 'FILE_NOT_WRITABLE';
  throw e;
}

function bridgeRequestId_(value) {
  const s = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,128}$/.test(s) ? s : '';
}

function bridgeError_(code, message) {
  return {
    ok: false,
    error: {
      code: String(code || 'BRIDGE_FAILURE'),
      message: String(message || '연결 요청을 처리하지 못했습니다.')
    }
  };
}

function bridgePageErrorHtml_(message) {
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;background:#111;color:#eee;font:15px/1.5 system-ui;padding:24px}.box{max-width:520px;margin:auto;padding:18px;border:1px solid #333;border-radius:14px;background:#181818}</style>' +
    '</head><body><div class="box"><b>유튜브다운로드</b><div style="margin-top:8px">' +
    String(message || '연결하지 못했습니다.') + '</div></div></body></html>';
}

function jsLiteral_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
