/* 유튜브다운로드 - Apps Script iframe POST transport */

const BRIDGE_ = Object.freeze({
  STATE_KEY: 'ytCollector.bridge.v1',
  TTL_MS: 10 * 60 * 1000,
  MAX_SESSIONS: 5
});

function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};
  const origin = allowedOrigin_(p.origin);
  const token = sessionToken_(p.token);
  const requestId = bridgeRequestId_(p.requestId);
  const mode = String(p.mode || '');

  if (mode === 'ui') {
    const nonce = bridgeNonce_(p.bridgeNonce);
    if (!origin || !token || !requestId || !nonce || !bridgeSessionValid_(origin, token, nonce)) {
      return HtmlService.createHtmlOutput(bridgeUiErrorHtml_('Google 연결이 만료되었습니다. YouTube에서 유튜브다운로드를 다시 실행해 주세요.'))
        .setTitle('유튜브다운로드')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    try {
      return HtmlService.createHtmlOutput(bridgeUiHtml_(origin, token))
        .setTitle('유튜브다운로드')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(bridgeUiErrorHtml_('유튜브다운로드 UI를 불러오지 못했습니다.'))
        .setTitle('유튜브다운로드')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }

  let result;
  if (!origin || !token || !requestId) {
    result = bridgeError_('INVALID_BRIDGE', '연결 정보가 올바르지 않습니다.');
  } else if (mode === 'init') {
    try {
      result = { ok: true, data: { bridgeNonce: bridgeStart_(origin, token), version: APP_.VERSION } };
    } catch (err) {
      result = bridgeError_('BRIDGE_FAILURE', 'Google 연결을 시작하지 못했습니다.');
    }
  } else if (mode === 'request') {
    const nonce = bridgeNonce_(p.bridgeNonce);
    if (!nonce || !bridgeSessionValid_(origin, token, nonce)) {
      result = bridgeError_('BRIDGE_EXPIRED', 'Google 연결이 만료되었습니다. 다시 연결해 주세요.');
    } else {
      const raw = String(p.request || '');
      if (!raw) {
        result = bridgeError_('INVALID_REQUEST', '요청 내용이 없습니다.');
      } else if (raw.length > APP_.MAX_REQUEST_CHARS) {
        result = bridgeError_('REQUEST_TOO_LARGE', '데이터가 너무 큽니다.');
      } else {
        try {
          result = bridgeDispatch_(JSON.parse(raw));
        } catch (err) {
          result = bridgeError_('INVALID_REQUEST', '요청 형식이 올바르지 않습니다.');
        }
      }
    }
  } else {
    result = bridgeError_('INVALID_BRIDGE', '연결 요청 종류가 올바르지 않습니다.');
  }

  return HtmlService.createHtmlOutput(bridgePostHtml_(origin, token, requestId, result))
    .setTitle('Google Sheets 연결')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function bridgeUiHtml_(origin, token) {
  const html = HtmlService.createHtmlOutputFromFile('ui').getContent();
  const start = '<script>\n(()=>{';
  const end = '\n})();\n</script>';
  const i = html.indexOf(start);
  const j = html.lastIndexOf(end);
  if (i < 0 || j <= i) throw new Error('UI_SCRIPT_NOT_FOUND');
  const hostCss = '<style id="ytdl-host-mode">.footer{display:none!important}.screen{padding-bottom:96px!important}</style>\n';
  const shim = '<script>' + bridgeUiShim_(origin, token) + '</script>\n';
  const body = html.slice(i + start.length, j);
  return html.slice(0, i) + hostCss + shim + '<script>\nwindow.__YTDL_BOOT.then(()=>{const parent=window.__YTDL_PARENT;' + body + bridgeUiHostTail_() + '\n});\n</script>' + html.slice(j + end.length);
}

function bridgeUiHostTail_() {
  return `
;(function(){
const hostSave=q('#save'),runSave=hostSave&&hostSave.onclick;
if(hostSave)hostSave.onclick=null;
function sendPlan(){
  let p;
  try{p=payload()}catch(e){return}
  const items=[];
  if(playerData){
    if(p.types.includes('video')){const x=spec('video',playerData);items.push({kind:'video',name:x.name,picker:x.picker})}
    if(p.types.includes('audio')){const x=spec('audio',playerData);items.push({kind:'audio',name:x.name,picker:x.picker})}
    if(p.types.includes('data')){const x=spec('data',playerData,p.data&&p.data.format);items.push({kind:'data',name:x.name,picker:x.picker})}
  }
  window.top.postMessage({type:'YTDL_SAVE_PLAN',token:parent.__YTDL_TOKEN,target:p.target||'',types:p.types||[],busy:!!S.busy,configured:!!S.configured,items:items},parent.location.origin);
}
window.__YTDL_RUN_SAVE=function(){if(!runSave||S.busy)return;Promise.resolve(runSave.call(hostSave)).catch(function(){})};
let planTimer=0;
function queuePlan(){clearTimeout(planTimer);planTimer=setTimeout(sendPlan,0)}
document.addEventListener('click',queuePlan,true);
document.addEventListener('change',queuePlan,true);
document.addEventListener('input',queuePlan,true);
try{new MutationObserver(queuePlan).observe(root,{subtree:true,childList:true,characterData:true,attributes:true})}catch(e){}
queuePlan();
})();`;
}

function bridgeUiShim_(origin, token) {
  const o = jsLiteral_(origin);
  const t = jsLiteral_(token);
  return `(function(){"use strict";
const O=${o},T=${t},P=new Map();let s=0,bootResolve,C={},L=null;
function rid(){return'u'+Date.now().toString(36)+(++s).toString(36)}
function rpc(action,payload){return new Promise((resolve,reject)=>{const id=rid(),z=setTimeout(()=>{P.delete(id);reject(new Error('YouTube 연결 응답이 없습니다.'))},1800000);P.set(id,{resolve,reject,z});window.top.postMessage({type:'YTDL_HOST_REQUEST',token:T,id,action,payload:payload||{}},O)})}
function opts(x){x=x||{};return{method:x.method||'GET',credentials:x.credentials||'omit',headers:x.headers||{},body:x.body==null?null:String(x.body)}}
function mediaUrl(u){try{const h=new URL(String(u)).hostname;return h==='googlevideo.com'||h.endsWith('.googlevideo.com')}catch(e){return false}}
function fakeFile(id){return{__id:id,createWritable:async()=>({__id:id,write:async v=>rpc('write-text',{handleId:id,text:String(v==null?'':v)}),close:async()=>{},abort:async()=>{}})}}
function fakeDir(id){return{getFileHandle:async name=>{const r=await rpc('dir-file',{dirId:id,name:String(name||'유튜브다운로드')});return fakeFile(r.id)}}}
async function hostFetch(url,o){url=String(url);if(mediaUrl(url))return{ok:true,status:206,body:{pipeTo:async w=>rpc('write-media',{handleId:w&&w.__id||'',url})},json:async()=>{throw new Error('미디어 JSON 없음')},text:async()=>''};const r=await rpc('fetch',{url,options:opts(o)});return{ok:!!r.ok,status:Number(r.status)||0,body:null,text:async()=>String(r.body||''),json:async()=>JSON.parse(String(r.body||''))}}
function metaDoc(){const M=C.meta||{},map={'meta[property="og:title"]':'ogTitle','meta[property="og:image"]':'ogImage','meta[itemprop="datePublished"]':'datePublished','meta[name="description"]':'description'};return{title:String(C.title||''),querySelector:q=>{const k=map[q];return k?{content:String(M[k]||'')}:null},querySelectorAll:()=>((C.likeTexts||[]).map(v=>({textContent:String(v),getAttribute:n=>n==='aria-label'?String(v):n==='title'?String(v):''})))}}
function makeParent(){const y=C.ytcfg||{};return{document:metaDoc(),location:{href:String(C.href||''),search:String(C.search||''),pathname:String(C.pathname||''),origin:O},fetch:hostFetch,ytcfg:{get:n=>y[n]},ytInitialData:{},open:(url,target)=>rpc('open',{url:String(url||''),target:String(target||'_blank')}),__YTDL_CALL:(a,p)=>rpc('gas',{action:a,payload:p||{}}),__YTDL_WEBAPP_URL:String(C.webapp||''),__YTDL_TOKEN:T,__YTDL_CLOSE:()=>rpc('close',{})}}
window.__YTDL_BOOT=new Promise(r=>bootResolve=r);
try{Object.defineProperty(window,'showSaveFilePicker',{configurable:true,value:async()=>{const id=L&&L.fileId;if(!id)throw new Error('로컬 저장 준비 정보가 없습니다.');L.fileId='';return fakeFile(id)}})}catch(e){window.showSaveFilePicker=async()=>{const id=L&&L.fileId;if(!id)throw new Error('로컬 저장 준비 정보가 없습니다.');L.fileId='';return fakeFile(id)}}
try{Object.defineProperty(window,'showDirectoryPicker',{configurable:true,value:async()=>{const id=L&&L.dirId;if(!id)throw new Error('로컬 저장 준비 정보가 없습니다.');L.dirId='';return fakeDir(id)}})}catch(e){window.showDirectoryPicker=async()=>{const id=L&&L.dirId;if(!id)throw new Error('로컬 저장 준비 정보가 없습니다.');L.dirId='';return fakeDir(id)}}
window.addEventListener('message',e=>{if(e.source!==window.top||e.origin!==O)return;const m=e.data;if(!m||m.token!==T)return;if(m.type==='YTDL_HOST_INIT'){C=m.context||{};window.__YTDL_PARENT=makeParent();bootResolve();return}if(m.type==='YTDL_HOST_SAVE'){L=m.local||null;Promise.resolve().then(()=>window.__YTDL_RUN_SAVE&&window.__YTDL_RUN_SAVE());return}if(m.type!=='YTDL_HOST_RESPONSE')return;const p=P.get(String(m.id||''));if(!p)return;P.delete(String(m.id));clearTimeout(p.z);m.ok?p.resolve(m.data):p.reject(new Error(m.error&&m.error.message||'YouTube 연결 실패'))});
window.top.postMessage({type:'YTDL_UI_READY',token:T},O);
})();`;
}

function bridgeUiErrorHtml_(message) {
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111;color:#eee;font:15px/1.5 system-ui;padding:24px}.box{max-width:520px;margin:auto;padding:18px;border:1px solid #333;border-radius:14px;background:#181818}</style></head><body><div class="box"><b>유튜브다운로드</b><div style="margin-top:8px">' + String(message || 'UI를 불러오지 못했습니다.') + '</div></div></body></html>';
}

function bridgeDispatch_(request) {
  if (request && request.action === 'get-ui') {
    try {
      const html = HtmlService.createHtmlOutputFromFile('ui').getContent();
      return ok_({ html: html });
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
  const categories = addCategory_({ fileId: connected.file.id, sheetName: sheetName, category: category }).categories;

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

function bridgeStart_(origin, token) {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(5000)) throw new Error('BUSY');
  try {
    const now = Date.now();
    let sessions = bridgeSessions_().filter(function (s) {
      return now - s.createdAt < BRIDGE_.TTL_MS && s.token !== token;
    });
    const nonce = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    sessions.push({ origin: origin, token: token, nonce: nonce, createdAt: now });
    if (sessions.length > BRIDGE_.MAX_SESSIONS) sessions = sessions.slice(-BRIDGE_.MAX_SESSIONS);
    PropertiesService.getUserProperties().setProperty(BRIDGE_.STATE_KEY, JSON.stringify(sessions));
    return nonce;
  } finally {
    lock.releaseLock();
  }
}

function bridgeSessionValid_(origin, token, nonce) {
  const now = Date.now();
  const sessions = bridgeSessions_().filter(function (s) { return now - s.createdAt < BRIDGE_.TTL_MS; });
  const found = sessions.some(function (s) {
    return s.origin === origin && s.token === token && s.nonce === nonce;
  });
  PropertiesService.getUserProperties().setProperty(BRIDGE_.STATE_KEY, JSON.stringify(sessions));
  return found;
}

function bridgeSessions_() {
  const raw = PropertiesService.getUserProperties().getProperty(BRIDGE_.STATE_KEY);
  if (!raw) return [];
  try {
    const a = JSON.parse(raw);
    return Array.isArray(a) ? a.filter(function (s) {
      return s && typeof s.origin === 'string' && typeof s.token === 'string' && typeof s.nonce === 'string' && Number.isFinite(Number(s.createdAt));
    }).map(function (s) {
      return { origin: s.origin, token: s.token, nonce: s.nonce, createdAt: Number(s.createdAt) };
    }) : [];
  } catch (e) {
    return [];
  }
}

function bridgeRequestId_(value) {
  const s = String(value || '').trim();
  return /^[A-Za-z0-9_-]{8,128}$/.test(s) ? s : '';
}

function bridgeNonce_(value) {
  const s = String(value || '').trim();
  return /^[A-Za-z0-9_-]{32,160}$/.test(s) ? s : '';
}

function bridgeError_(code, message) {
  return { ok: false, error: { code: String(code || 'BRIDGE_FAILURE'), message: String(message || '연결 요청을 처리하지 못했습니다.') } };
}

function bridgePostHtml_(origin, token, requestId, result) {
  const target = jsLiteral_({
    type: 'YT_GAS_RESPONSE',
    token: token,
    requestId: requestId,
    result: result || bridgeError_('BRIDGE_FAILURE', '연결 요청을 처리하지 못했습니다.')
  });
  const o = jsLiteral_(origin);
  const valid = Boolean(origin && token && requestId);
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Google Sheets 연결</title>' +
    '<style>body{margin:0;background:#111;color:#eee;font:15px/1.5 system-ui;padding:16px}.box{max-width:520px;margin:auto;padding:16px;border:1px solid #333;border-radius:12px;background:#181818}</style></head><body>' +
    '<div class="box"><b>Google Sheets 연결</b><div id="s" style="margin-top:8px">' + (valid ? '응답 전송 중…' : '잘못된 연결 요청입니다.') + '</div></div>' +
    '<script>(function(){"use strict";const O=' + o + ',M=' + target + ';if(!O)return;try{window.top.postMessage(M,O);document.getElementById("s").textContent=M.result&&M.result.ok?"연결됨":"요청 실패"}catch(e){document.getElementById("s").textContent="응답 전송 실패"}})();<\/script></body></html>';
}

function jsLiteral_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
