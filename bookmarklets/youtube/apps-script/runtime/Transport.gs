/* 유튜브다운로드 - GitHub 원격 Apps Script 브리지 런타임 */

const BRIDGE_ORIGINS_ = Object.freeze([
  'https://www.youtube.com',
  'https://m.youtube.com',
  'https://youtube.com',
  'https://music.youtube.com'
]);

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (String(p.mode || '') !== 'bridge') {
    return bridgeOutput_(infoPageHtml_('유튜브다운로드', 'YouTube에서 유튜브다운로드를 실행해 주세요.'));
  }

  const origin = allowedOrigin_(p.origin);
  const token = sessionToken_(p.token);
  if (!origin || !token) return bridgeOutput_(infoPageHtml_('유튜브다운로드', '연결 정보가 올바르지 않습니다.'));

  try {
    return bridgeOutput_(bridgeTopHtml_(origin, token));
  } catch (err) {
    return bridgeOutput_(infoPageHtml_('유튜브다운로드', '유튜브다운로드 연결 페이지를 만들지 못했습니다.'));
  }
}

function bridgeOutput_(html) {
  return HtmlService.createHtmlOutput(html)
    .setTitle('유튜브다운로드 - Google 연결')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function bridgeTopHtml_(origin, token) {
  const ui = ytRemoteText_('ui.html');
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;background:#111;color:#eee;font:15px/1.5 system-ui;padding:24px}.box{max-width:520px;margin:auto;padding:18px;border:1px solid #333;border-radius:14px;background:#181818}.sub{margin-top:8px;color:#aaa;font-size:13px}</style>' +
    '</head><body><div class="box"><b>유튜브다운로드 · Google 연결</b><div id="s" class="sub">YouTube 연결 신호를 기다리는 중…</div></div>' +
    '<script>(function(){"use strict";const O=' + jsLiteral_(origin) + ',T=' + jsLiteral_(token) + ',H=' + jsLiteral_(ui) + ',S=document.getElementById("s");let P=null;' +
    'function post(m){try{if(P&&!P.closed)P.postMessage(m,O)}catch(e){}}' +
    'function ready(){if(!P)return;post({type:"YTDL_BRIDGE_READY",token:T,html:H});S.textContent="연결 완료 · YouTube 화면으로 돌아가세요.";try{P.focus()}catch(e){}}' +
    'window.addEventListener("message",function(e){if(e.origin!==O)return;const m=e.data;if(!m||m.token!==T)return;' +
    'if(m.type==="YTDL_BRIDGE_HELLO"){P=e.source;ready();return}' +
    'if(e.source!==P)return;' +
    'if(m.type==="YTDL_BRIDGE_CLOSE"){try{window.top.close()}catch(x){}return}' +
    'if(m.type!=="YTDL_BRIDGE_REQUEST"||typeof m.id!=="string")return;' +
    'google.script.run.withSuccessHandler(function(r){if(r&&r.ok)post({type:"YTDL_BRIDGE_RESPONSE",token:T,id:m.id,ok:true,data:r.data});else post({type:"YTDL_BRIDGE_RESPONSE",token:T,id:m.id,ok:false,error:r&&r.error||{message:"Google 요청 실패"}})}).withFailureHandler(function(x){post({type:"YTDL_BRIDGE_RESPONSE",token:T,id:m.id,ok:false,error:{message:x&&x.message||"Google 요청 실패"}})}).dispatch(m.request);' +
    '});' +
    '})();<\/script></body></html>';
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
    fail_('FILE_NOT_WRITABLE', 'Google Sheets 파일을 자동으로 만들 수 없습니다.');
  }

  const connected = connectFile_({ sheetUrl: ss.getUrl() });
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

function allowedOrigin_(value) {
  const origin = String(value || '').trim();
  return BRIDGE_ORIGINS_.indexOf(origin) >= 0 ? origin : '';
}

function sessionToken_(value) {
  const token = String(value || '').trim();
  return /^[A-Za-z0-9_-]{16,128}$/.test(token) ? token : '';
}

function infoPageHtml_(heading, message) {
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>body{margin:0;background:#111;color:#eee;font:15px/1.5 system-ui;padding:24px}.box{max-width:520px;margin:auto;padding:18px;border:1px solid #333;border-radius:14px;background:#181818}h1{font-size:18px;margin:0 0 8px}</style>' +
    '</head><body><div class="box"><h1>' + htmlEscape_(heading) + '</h1><div>' + htmlEscape_(message) + '</div></div></body></html>';
}

function htmlEscape_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function jsLiteral_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
