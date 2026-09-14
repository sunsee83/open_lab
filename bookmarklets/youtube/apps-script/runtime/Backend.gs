/* 유튜브다운로드 - Apps Script / SpreadsheetApp */

const APP_ = Object.freeze({
  VERSION: '0.4.3',
  STATE_KEY: 'ytCollector.state.v2',
  MAX_REQUEST_CHARS: 1000000,
  MAX_STATE_CHARS: 9000,
  MAX_FILES: 10,
  GUIDE_NAME: '안내',
  GUIDE_TITLE: '유튜브다운로드 안내',
  CATEGORY_MARKER: 'YTDL_CATEGORY_V1',
  MAX_DATA_SHEETS: 10,
  MAX_ROWS: 2000,
  WARN_ROWS: 1800,
  MAX_CATEGORIES: 30,
  MAX_CELL_CHARS: 49000,
  PURPOSES: Object.freeze(['공부', '자료조사', '아이디어', '보관']),
  STATUSES: Object.freeze(['미분석', '분석중', '완료', '보류']),
  HEADERS: Object.freeze([
    '썸네일', '제목', '채널명', '카테고리', '활용 목적', '중요도', '상태', '내 태그', '메모',
    '업로드일', '영상 길이', '조회수', '좋아요', '영상 언어', '태그 / 해시태그', '설명', '대본', '댓글',
    '인상적인 구간', '관련 그룹 ID', 'AI 전송', 'AI 요약', '핵심 주장', '핵심 키워드', '사실확인 필요',
    '댓글 반응 요약', '타임스탬프 핵심', '영상 URL', '영상 ID', '채널 ID', '자막 원본', '원본 메타데이터',
    '수집일시', '수정일시'
  ])
});

const RECORD_COLUMNS_ = Object.freeze({
  title: '제목', channel: '채널명', publishedAt: '업로드일', duration: '영상 길이', views: '조회수',
  likes: '좋아요', language: '영상 언어', tags: '태그 / 해시태그', description: '설명', transcript: '대본',
  comments: '댓글', channelId: '채널 ID', rawCaptions: '자막 원본', rawMetadata: '원본 메타데이터'
});

const MANAGEMENT_COLUMNS_ = Object.freeze({
  category: '카테고리', purpose: '활용 목적', priority: '중요도', status: '상태', tags: '내 태그', memo: '메모',
  highlights: '인상적인 구간', groupId: '관련 그룹 ID', aiSend: 'AI 전송', aiSummary: 'AI 요약',
  keyClaims: '핵심 주장', keyKeywords: '핵심 키워드', factCheck: '사실확인 필요',
  commentSummary: '댓글 반응 요약', timestampSummary: '타임스탬프 핵심'
});

const HEADER_INDEX_ = Object.freeze(APP_.HEADERS.reduce(function (map, header, index) {
  map[header] = index;
  return map;
}, {}));

function dispatch(request) {
  try {
    validateRequest_(request);
    const payload = plain_(request.payload) ? request.payload : {};
    switch (request.action) {
      case 'ping': return ok_({ version: APP_.VERSION, limits: limits_() });
      case 'get-state': return ok_(publicState_());
      case 'create-storage': return ok_(bridgeCreateStorage_(payload));
      case 'connect-file': return ok_(connectFile_(payload));
      case 'unlink-file': return ok_(unlinkFile_(payload));
      case 'list-sheets': return ok_(listSheets_(payload));
      case 'create-sheet': return ok_(createSheet_(payload));
      case 'list-categories': return ok_(listCategories_(payload));
      case 'add-category': return ok_(addCategory_(payload));
      case 'check-duplicate': return ok_(checkDuplicate_(payload));
      case 'save-record': return ok_(saveRecord_(payload));
      default: fail_('INVALID_ACTION', '허용되지 않은 요청입니다.');
    }
  } catch (err) {
    return errorResult_(err);
  }
}

function limits_() {
  return {
    maxFiles: APP_.MAX_FILES,
    guideSheets: 1,
    maxDataSheets: APP_.MAX_DATA_SHEETS,
    maxTotalSheets: APP_.MAX_DATA_SHEETS + 1,
    maxRows: APP_.MAX_ROWS,
    warnRows: APP_.WARN_ROWS,
    maxCellChars: APP_.MAX_CELL_CHARS,
    longDataPolicy: 'truncate-with-marker'
  };
}

function connectFile_(p) {
  const fileId = spreadsheetIdFromUrl_(requiredText_(p.sheetUrl, 'Sheets 링크', 2048));
  let ss;
  try { ss = SpreadsheetApp.openById(fileId); }
  catch (e) { fail_('FILE_NO_ACCESS', '이 파일을 열 수 없습니다. 현재 계정의 권한을 확인해 주세요.'); }
  ensureGuide_(ss);
  const state = loadState_();
  const i = state.files.findIndex(function (f) { return f.id === fileId; });
  if (i < 0 && state.files.length >= APP_.MAX_FILES) fail_('FILE_LIMIT', '연결 파일은 최대 10개입니다.');
  const file = { id: fileId, name: trim_(ss.getName(), 120) || 'Google Sheets' };
  if (i < 0) state.files.push(file); else state.files[i] = file;
  if (!state.defaultFileId) state.defaultFileId = fileId;
  saveState_(state);
  return { file: publicFile_(file), sheets: sheetList_(ss), capacity: fileCapacity_(ss) };
}

function unlinkFile_(p) {
  const fileId = linkedFileId_(p.fileId);
  const state = loadState_();
  state.files = state.files.filter(function (f) { return f.id !== fileId; });
  state.categoryGroups = state.categoryGroups.filter(function (g) { return g.fileId !== fileId; });
  state.defaultFileId = state.files.length ? state.files[0].id : '';
  saveState_(state);
  return { removed: true, fileId: fileId };
}

function listSheets_(p) {
  const ss = openLinked_(p.fileId);
  ensureGuide_(ss);
  refreshFileName_(ss.getId(), ss.getName());
  return { file: publicFile_({ id: ss.getId(), name: ss.getName() }), sheets: sheetList_(ss), capacity: fileCapacity_(ss) };
}

function createSheet_(p) {
  const fileId = linkedFileId_(p.fileId);
  const name = dataSheetName_(p.sheetName);
  return locked_(function () {
    const ss = openLinked_(fileId);
    ensureGuide_(ss);
    let sheet = ss.getSheetByName(name);
    let created = false;
    if (!sheet) {
      if (fileCapacity_(ss).dataSheets >= APP_.MAX_DATA_SHEETS) fail_('SHEET_LIMIT', '데이터 시트는 최대 10개입니다.');
      sheet = ss.insertSheet(name);
      created = true;
    }
    if (isGuide_(sheet)) fail_('GUIDE_RESERVED', '안내 시트에는 데이터를 저장할 수 없습니다.');
    ensureSchema_(sheet);
    return { created: created, sheet: publicSheet_(ss, sheet), capacity: fileCapacity_(ss) };
  });
}

function listCategories_(p) {
  const fileId = linkedFileId_(p.fileId);
  const sheetName = dataSheetName_(p.sheetName);
  return locked_(function () {
    const ss = openLinked_(fileId);
    getDataSheet_(ss, sheetName);
    return { fileId: fileId, sheetName: sheetName, categories: categoriesFor_(ss, fileId, sheetName) };
  });
}

function addCategory_(p) {
  const fileId = linkedFileId_(p.fileId);
  const sheetName = dataSheetName_(p.sheetName);
  const category = requiredText_(p.category, '카테고리', 60);
  return locked_(function () {
    const ss = openLinked_(fileId);
    getDataSheet_(ss, sheetName);
    const items = categoriesFor_(ss, fileId, sheetName);
    if (items.indexOf(category) < 0) {
      if (items.length >= APP_.MAX_CATEGORIES) fail_('CATEGORY_LIMIT', '카테고리는 시트당 최대 30개입니다.');
      appendCategory_(ss, sheetName, category);
      items.push(category);
    }
    return { fileId: fileId, sheetName: sheetName, categories: items };
  });
}

function checkDuplicate_(p) {
  const ss = openLinked_(p.fileId);
  const sheet = getDataSheet_(ss, dataSheetName_(p.sheetName));
  const videoId = videoId_(p.videoId);
  ensureSchema_(sheet);
  const rows = videoRows_(sheet, videoId);
  return {
    found: rows.length > 0,
    rows: rows.map(function (r) { return { row: r, url: rangeUrl_(ss, sheet, 'B' + r) }; }),
    capacity: sheetCapacity_(sheet)
  };
}

function saveRecord_(p) {
  const fileId = linkedFileId_(p.fileId);
  const sheetName = dataSheetName_(p.sheetName);
  const record = plain_(p.record) ? p.record : {};
  const management = plain_(p.management) ? p.management : {};
  const clearManagement = Array.isArray(p.clearManagement) ? p.clearManagement.map(String).filter(function (key, i, all) {
    return hasOwn_(MANAGEMENT_COLUMNS_, key) && all.indexOf(key) === i;
  }) : [];
  const videoId = videoId_(p.videoId || record.videoId);
  const mode = p.duplicateMode == null ? '' : String(p.duplicateMode);
  const targetRow = p.targetRow == null ? null : Number(p.targetRow);
  if (mode && ['update', 'new'].indexOf(mode) < 0) fail_('INVALID_DUPLICATE_MODE', '중복 처리 방식이 올바르지 않습니다.');
  if (targetRow != null && (!Number.isInteger(targetRow) || targetRow < 2)) fail_('INVALID_ROW', '수정할 행이 올바르지 않습니다.');
  return locked_(function () {
    const ss = openLinked_(fileId);
    const sheet = getDataSheet_(ss, sheetName);
    ensureSchema_(sheet);
    const duplicates = videoRows_(sheet, videoId);
    if (duplicates.length && !mode) {
      return { status: 'duplicate', duplicates: duplicateLinks_(ss, sheet, duplicates), capacity: sheetCapacity_(sheet) };
    }
    if (mode === 'update') {
      let rowNumber = targetRow;
      if (rowNumber == null) {
        if (duplicates.length === 1) rowNumber = duplicates[0];
        else if (duplicates.length > 1) fail_('MULTIPLE_DUPLICATES', '같은 영상이 여러 행에 있습니다.');
        else fail_('DUPLICATE_NOT_FOUND', '업데이트할 기존 기록을 찾지 못했습니다.');
      }
      if (duplicates.indexOf(rowNumber) < 0) fail_('ROW_MISMATCH', '선택한 행과 영상 ID가 일치하지 않습니다.');
      const current = sheet.getRange(rowNumber, 1, 1, APP_.HEADERS.length).getValues()[0];
      const changed = {};
      const truncatedFields = [];
      const next = buildRow_(current, videoId, record, management, clearManagement, false, changed, truncatedFields);
      const changedIndexes = Object.keys(changed).map(Number).sort(function (a, b) { return a - b; });
      if (!changedIndexes.length) {
        return { status: 'unchanged', row: rowNumber, url: rangeUrl_(ss, sheet, 'B' + rowNumber), capacity: sheetCapacity_(sheet), truncatedFields: truncatedFields };
      }
      writeChangedCells_(sheet, rowNumber, next, changedIndexes);
      applyPresentation_(sheet, rowNumber, record, videoId, false);
      return { status: 'updated', row: rowNumber, url: rangeUrl_(ss, sheet, 'B' + rowNumber), capacity: sheetCapacity_(sheet), truncatedFields: truncatedFields };
    }
    const cap = sheetCapacity_(sheet);
    if (cap.used >= APP_.MAX_ROWS) fail_('ROW_LIMIT', '이 시트는 2,000개 한도에 도달했습니다.');
    const rowNumber = nextRecordRow_(sheet);
    ensureRows_(sheet, rowNumber);
    const truncatedFields = [];
    const next = buildRow_(new Array(APP_.HEADERS.length).fill(''), videoId, record, management, clearManagement, true, null, truncatedFields);
    sheet.getRange(rowNumber, 1, 1, APP_.HEADERS.length).setValues([next]);
    applyPresentation_(sheet, rowNumber, record, videoId, true);
    return { status: 'created', row: rowNumber, url: rangeUrl_(ss, sheet, 'B' + rowNumber), capacity: sheetCapacity_(sheet), truncatedFields: truncatedFields };
  });
}

function duplicateLinks_(ss, sheet, rows) {
  return rows.map(function (r) { return { row: r, url: rangeUrl_(ss, sheet, 'B' + r) }; });
}

function buildRow_(base, videoId, record, management, clearManagement, isNew, changed, truncatedFields) {
  const row = base.slice(0, APP_.HEADERS.length);
  while (row.length < APP_.HEADERS.length) row.push('');
  const ix = HEADER_INDEX_;
  if (isNew) {
    assignRowValue_(row, ix['영상 ID'], videoId, changed);
    assignRowValue_(row, ix['영상 URL'], 'https://www.youtube.com/watch?v=' + videoId, changed);
  }
  Object.keys(RECORD_COLUMNS_).forEach(function (key) {
    if (!hasOwn_(record, key)) return;
    const value = record[key];
    if (value == null) return;
    assignRowValue_(row, ix[RECORD_COLUMNS_[key]], serializeRecord_(key, value, truncatedFields), changed);
  });
  Object.keys(MANAGEMENT_COLUMNS_).forEach(function (key) {
    const header = MANAGEMENT_COLUMNS_[key];
    if (clearManagement.indexOf(key) >= 0) { assignRowValue_(row, ix[header], '', changed); return; }
    if (!hasOwn_(management, key)) return;
    const value = management[key];
    if (value === '' || value == null) return;
    assignRowValue_(row, ix[header], managementValue_(key, value, truncatedFields), changed);
  });
  const now = new Date().toISOString();
  const hasContentChange = isNew || Object.keys(changed || {}).length > 0 || hasOwn_(record, 'thumbnail');
  if (isNew || !row[ix['수집일시']]) assignRowValue_(row, ix['수집일시'], now, changed);
  if (hasContentChange) assignRowValue_(row, ix['수정일시'], now, changed);
  return row;
}

function assignRowValue_(row, index, value, changed) {
  const next = safe_(value);
  const current = row[index];
  if (current === next || String(current == null ? '' : current) === String(next == null ? '' : next)) return;
  row[index] = next;
  if (changed) changed[index] = true;
}

function writeChangedCells_(sheet, rowNumber, row, indexes) {
  if (!indexes.length) return;
  let start = indexes[0], end = start;
  function write_() {
    sheet.getRange(rowNumber, start + 1, 1, end - start + 1).setValues([row.slice(start, end + 1)]);
  }
  for (let i = 1; i < indexes.length; i++) {
    if (indexes[i] === end + 1) { end = indexes[i]; continue; }
    write_();
    start = end = indexes[i];
  }
  write_();
}

function serializeRecord_(key, value, truncatedFields) {
  let out = value;
  if (key === 'tags') out = listText_(value);
  else if (key === 'transcript') out = plain_(value) && typeof value.text === 'string' ? value.text : json_(value);
  else if (key === 'comments' || key === 'rawCaptions' || key === 'rawMetadata') out = json_(value);
  noteTruncation_(out, RECORD_COLUMNS_[key], truncatedFields);
  return out;
}

function managementValue_(key, value, truncatedFields) {
  if (key === 'priority') { const n = Number(value); if (!Number.isInteger(n) || n < 1 || n > 5) fail_('INVALID_PRIORITY', '중요도는 1~5입니다.'); return n; }
  if (key === 'purpose') { const s = String(value); if (APP_.PURPOSES.indexOf(s) < 0) fail_('INVALID_PURPOSE', '활용 목적 값이 올바르지 않습니다.'); return s; }
  if (key === 'status') { const s = String(value); if (APP_.STATUSES.indexOf(s) < 0) fail_('INVALID_STATUS', '상태 값이 올바르지 않습니다.'); return s; }
  if (key === 'aiSend') return Boolean(value);
  let out = value;
  if (['tags', 'highlights', 'keyKeywords'].indexOf(key) >= 0) out = listText_(value);
  else if (Array.isArray(value)) out = value.map(String).join('\n');
  else if (plain_(value)) out = json_(value);
  noteTruncation_(out, MANAGEMENT_COLUMNS_[key], truncatedFields);
  return out;
}

function noteTruncation_(value, label, truncatedFields) {
  if (!Array.isArray(truncatedFields) || value == null || typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) return;
  const text = String(value).replace(/\u0000/g, '');
  if (text.length > APP_.MAX_CELL_CHARS && truncatedFields.indexOf(label) < 0) truncatedFields.push(label);
}

function ensureGuide_(ss) {
  let sheet = ss.getSheetByName(APP_.GUIDE_NAME);
  let created = false;
  if (!sheet) {
    try { sheet = ss.insertSheet(APP_.GUIDE_NAME, 0); created = true; }
    catch (e) { fail_('FILE_NOT_WRITABLE', '안내 시트를 만들 수 없습니다.'); }
  } else {
    const title = String(sheet.getRange('A1').getDisplayValue() || '').trim();
    if (title && title !== APP_.GUIDE_TITLE && title !== 'YouTube 수집도구 안내') {
      fail_('GUIDE_CONFLICT', '기존 안내 탭을 보호하기 위해 연결을 중단했습니다.');
    }
  }

  const versionLabel = '도구 버전: ' + APP_.VERSION;
  const currentTitle = String(sheet.getRange('A1').getDisplayValue() || '').trim();
  const currentVersion = String(sheet.getRange('A19').getDisplayValue() || '').trim();
  if (created || currentTitle !== APP_.GUIDE_TITLE || currentVersion !== versionLabel) {
    const rows = [
      [APP_.GUIDE_TITLE], [''],
      ['저장 경로'], ['YouTube → 유튜브다운로드 → Apps Script → 이 파일 → 선택한 데이터 시트'], [''],
      ['데이터 구조'], ['• 가로 = 항목, 세로 = 영상 / 한 영상 = 한 행'], [''],
      ['제한'], ['• 안내 1개 + 데이터 시트 최대 10개'], ['• 시트당 최대 2,000개 / 1,800개부터 새 시트 권장'], ['• 2,000개부터 신규 추가 중지, 기존 기록 수정 가능'], [''],
      ['기본 규칙'], ['• 영상 ID로 중복 확인'], ['• 수집 실패 항목과 사용자 관리값은 기존값 보존'], ['• 수집일 유지 / 수정일 자동 갱신'], ['• 도구는 파일·시트·행을 자동 삭제하지 않음'],
      [versionLabel]
    ];
    const clearRows = Math.max(rows.length, Math.min(sheet.getMaxRows(), 40));
    sheet.getRange(1, 1, clearRows, 1).clearContent();
    sheet.getRange(1, 1, rows.length, 1).setValues(rows).setWrap(true).setVerticalAlignment('top');
    ['A1', 'A3', 'A6', 'A9', 'A14'].forEach(function (a1) { sheet.getRange(a1).setFontWeight('bold'); });
    sheet.getRange('A1').setFontSize(16);
    sheet.setColumnWidth(1, 700);
    sheet.setFrozenRows(1);
    sheet.setHiddenGridlines(true);
  }
  ensureGuideCategoryMeta_(sheet);
  try { sheet.hideColumns(3, 2); } catch (e) {}
  if (created || sheet.getIndex() !== 1) {
    try { ss.setActiveSheet(sheet); ss.moveActiveSheet(1); }
    catch (e) { fail_('FILE_NOT_WRITABLE', '안내 시트를 첫 번째로 이동할 수 없습니다.'); }
  }
  return sheet;
}

function ensureGuideCategoryMeta_(guide) {
  if (String(guide.getRange(1, 3).getValue() || '') !== APP_.CATEGORY_MARKER) {
    guide.getRange(1, 3, 1, 2).setValues([[APP_.CATEGORY_MARKER, '카테고리']]);
  }
}

function categoriesFor_(ss, fileId, sheetName) {
  const guide = ensureGuide_(ss);
  const last = Math.max(guide.getLastRow(), 2);
  const values = guide.getRange(2, 3, last - 1, 2).getDisplayValues();
  const items = [];
  values.forEach(function (r) {
    if (String(r[0]).trim() !== sheetName) return;
    const c = trim_(r[1], 60);
    if (c && items.indexOf(c) < 0) items.push(c);
  });
  const state = loadState_();
  const legacy = categoryGroup_(state, fileId, sheetName);
  if (legacy) {
    legacy.items.forEach(function (c) {
      if (items.indexOf(c) < 0 && items.length < APP_.MAX_CATEGORIES) {
        appendCategory_(ss, sheetName, c);
        items.push(c);
      }
    });
    state.categoryGroups = state.categoryGroups.filter(function (g) { return !(g.fileId === fileId && g.sheetName === sheetName); });
    saveState_(state);
  }
  return items;
}

function appendCategory_(ss, sheetName, category) {
  const guide = ensureGuide_(ss);
  const max = Math.max(guide.getMaxRows(), 2);
  const values = guide.getRange(2, 3, max - 1, 2).getDisplayValues();
  for (let i = 0; i < values.length; i++) {
    const s = String(values[i][0] || '').trim(), c = String(values[i][1] || '').trim();
    if (s === sheetName && c === category) return;
    if (!s && !c) {
      guide.getRange(i + 2, 3, 1, 2).setValues([[sheetName, category]]);
      return;
    }
  }
  guide.insertRowsAfter(guide.getMaxRows(), 1);
  guide.getRange(guide.getMaxRows(), 3, 1, 2).setValues([[sheetName, category]]);
}

function initDataSheet_(sheet) {
  ensureGrid_(sheet, APP_.MAX_ROWS + 1, APP_.HEADERS.length);
  sheet.getRange(1, 1, 1, APP_.HEADERS.length).setValues([APP_.HEADERS.slice()]).setFontWeight('bold').setWrap(true);
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(3);
  sheet.setRowHeight(1, 34);
  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 280);
  sheet.setColumnWidth(3, 180);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 110);
  sheet.setColumnWidth(6, 70);
  sheet.setColumnWidth(7, 90);
  sheet.setColumnWidth(8, 160);
  sheet.setColumnWidth(9, 220);
  const n = APP_.MAX_ROWS;
  sheet.getRange(2, 5, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(APP_.PURPOSES.slice(), true).setAllowInvalid(false).build());
  sheet.getRange(2, 6, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(['1','2','3','4','5'], true).setAllowInvalid(false).build());
  sheet.getRange(2, 7, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(APP_.STATUSES.slice(), true).setAllowInvalid(false).build());
  sheet.getRange(2, HEADER_INDEX_['AI 전송'] + 1, n, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().setAllowInvalid(false).build());
}

function ensureRows_(sheet, rowNumber) {
  const max = sheet.getMaxRows();
  if (max < rowNumber) sheet.insertRowsAfter(max, rowNumber - max);
}
function ensureColumns_(sheet, columnNumber) {
  const max = sheet.getMaxColumns();
  if (max < columnNumber) sheet.insertColumnsAfter(max, columnNumber - max);
}
function ensureGrid_(sheet, rowNumber, columnNumber) {
  ensureRows_(sheet, rowNumber);
  ensureColumns_(sheet, columnNumber);
}

function ensureSchema_(sheet) {
  const width = Math.min(APP_.HEADERS.length, sheet.getMaxColumns());
  const actual = width > 0 ? sheet.getRange(1, 1, 1, width).getDisplayValues()[0] : [];
  const header = new Array(APP_.HEADERS.length).fill('');
  for (let i = 0; i < actual.length; i++) header[i] = actual[i];
  if (header.every(function (x) { return String(x || '').trim() === ''; })) {
    if (sheet.getLastRow() > 0) fail_('SCHEMA_MISMATCH', '기존 데이터가 있는 시트에는 도구 헤더를 자동으로 만들지 않습니다.');
    initDataSheet_(sheet);
    return;
  }
  if (sheet.getMaxColumns() < APP_.HEADERS.length) fail_('SCHEMA_MISMATCH', '열 이름/순서가 달라 저장을 중단했습니다.');
  assertSchema_(sheet, header);
}

function assertSchema_(sheet, actual) {
  const row = actual || sheet.getRange(1, 1, 1, APP_.HEADERS.length).getDisplayValues()[0];
  for (let i = 0; i < APP_.HEADERS.length; i++) if (row[i] !== APP_.HEADERS[i]) fail_('SCHEMA_MISMATCH', '열 이름/순서가 달라 저장을 중단했습니다.');
}

function applyPresentation_(sheet, rowNumber, record, videoId, isNew) {
  const ix = HEADER_INDEX_;
  if (isNew || hasOwn_(record, 'thumbnail')) {
    sheet.getRange(rowNumber, ix['썸네일'] + 1).setFormula('=IMAGE("https://i.ytimg.com/vi/' + videoId + '/mqdefault.jpg",4,68,120)');
    sheet.setRowHeight(rowNumber, 68);
  }
  if (isNew || hasOwn_(record, 'title')) setLink_(sheet.getRange(rowNumber, ix['제목'] + 1), record.title || '', 'https://www.youtube.com/watch?v=' + videoId);
  if (isNew || hasOwn_(record, 'channel') || hasOwn_(record, 'channelId')) {
    const channelRange = sheet.getRange(rowNumber, ix['채널명'] + 1);
    const channel = hasOwn_(record, 'channel') ? record.channel : channelRange.getDisplayValue();
    const channelId = channelIdSoft_(hasOwn_(record, 'channelId') ? record.channelId : sheet.getRange(rowNumber, ix['채널 ID'] + 1).getDisplayValue());
    if (channel && channelId) setLink_(channelRange, channel, 'https://www.youtube.com/channel/' + channelId);
  }
  setLink_(sheet.getRange(rowNumber, ix['영상 URL'] + 1), 'https://www.youtube.com/watch?v=' + videoId, 'https://www.youtube.com/watch?v=' + videoId);
}

function setLink_(range, text, url) {
  const label = safe_(text);
  if (!label) { range.setValue(''); return; }
  try { range.setRichTextValue(SpreadsheetApp.newRichTextValue().setText(String(label)).setLinkUrl(url).build()); }
  catch (e) { range.setValue(label); }
}

function videoIdRange_(sheet) {
  const col = HEADER_INDEX_['영상 ID'] + 1;
  if (sheet.getMaxRows() < 2 || sheet.getMaxColumns() < col) return null;
  return sheet.getRange(2, col, sheet.getMaxRows() - 1, 1);
}

function recordRows_(sheet) {
  const range = videoIdRange_(sheet);
  if (!range) return [];
  return range.createTextFinder('.+').useRegularExpression(true).findAll().map(function (c) { return c.getRow(); });
}

function videoRows_(sheet, videoId) {
  const range = videoIdRange_(sheet);
  if (!range) return [];
  return range.createTextFinder(videoId).matchEntireCell(true).useRegularExpression(false).findAll().map(function (c) { return c.getRow(); });
}

function nextRecordRow_(sheet) {
  const used = {};
  recordRows_(sheet).forEach(function (r) { used[r] = true; });
  for (let r = 2; r <= APP_.MAX_ROWS + 1; r++) if (!used[r]) return r;
  fail_('ROW_LIMIT', '이 시트는 2,000개 한도에 도달했습니다.');
}

function sheetCapacity_(sheet) {
  const used = recordRows_(sheet).length;
  return { used: used, max: APP_.MAX_ROWS, warningAt: APP_.WARN_ROWS, nearLimit: used >= APP_.WARN_ROWS, full: used >= APP_.MAX_ROWS };
}

function fileCapacity_(ss) {
  const all = ss.getSheets();
  const data = all.filter(function (s) { return !isGuide_(s); }).length;
  return { totalSheets: all.length, dataSheets: data, maxDataSheets: APP_.MAX_DATA_SHEETS, maxTotalSheets: APP_.MAX_DATA_SHEETS + 1, full: data >= APP_.MAX_DATA_SHEETS, overLimit: data > APP_.MAX_DATA_SHEETS || all.length > APP_.MAX_DATA_SHEETS + 1 };
}

function sheetList_(ss) { return ss.getSheets().map(function (s) { return publicSheet_(ss, s); }); }
function publicSheet_(ss, sheet) {
  const guide = isGuide_(sheet);
  const out = { id: sheet.getSheetId(), name: sheet.getName(), kind: guide ? 'guide' : 'data', selectable: !guide, hidden: sheet.isSheetHidden(), url: rangeUrl_(ss, sheet, '') };
  if (!guide) out.capacity = sheetCapacity_(sheet);
  return out;
}
function publicFile_(f) { return { id: f.id, name: trim_(f.name || 'Google Sheets', 120), url: 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(f.id) + '/edit' }; }
function rangeUrl_(ss, sheet, a1) { const u = ss.getUrl() + '#gid=' + sheet.getSheetId(); return a1 ? u + '&range=' + encodeURIComponent(a1) : u; }

function openLinked_(fileId) {
  const id = linkedFileId_(fileId);
  try { return SpreadsheetApp.openById(id); }
  catch (e) { fail_('FILE_NO_ACCESS', '연결된 파일을 열 수 없습니다.'); }
}
function getDataSheet_(ss, name) { const s = ss.getSheetByName(name); if (!s) fail_('SHEET_NOT_FOUND', '시트를 찾을 수 없습니다.'); if (isGuide_(s)) fail_('GUIDE_RESERVED', '안내 시트는 저장 대상이 아닙니다.'); return s; }
function isGuide_(sheet) { return sheet && sheet.getName() === APP_.GUIDE_NAME; }

function spreadsheetIdFromUrl_(url) {
  const m = String(url).match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]{10,200})(?:\/|$)/);
  if (!m) fail_('INVALID_SHEETS_URL', 'Google Sheets 링크를 붙여넣어 주세요.');
  return m[1];
}
function linkedFileId_(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{10,200}$/.test(id)) fail_('INVALID_FILE_ID', '파일 정보가 올바르지 않습니다.');
  if (!loadState_().files.some(function (f) { return f.id === id; })) fail_('FILE_NOT_LINKED', '먼저 파일을 연결해 주세요.');
  return id;
}
function videoId_(value) { const id = String(value || '').trim(); if (!/^[A-Za-z0-9_-]{6,64}$/.test(id)) fail_('INVALID_VIDEO_ID', '영상 ID가 올바르지 않습니다.'); return id; }
function channelIdSoft_(value) { const id = String(value || '').trim(); return /^[A-Za-z0-9_-]{6,128}$/.test(id) ? id : ''; }
function dataSheetName_(value) { const s = requiredText_(value, '시트 이름', 100); if (s === APP_.GUIDE_NAME || /[\\\/\?\*\[\]:]/.test(s)) fail_('INVALID_SHEET_NAME', '사용할 수 없는 시트 이름입니다.'); return s; }

function categoryGroup_(state, fileId, sheetName) { return state.categoryGroups.find(function (g) { return g.fileId === fileId && g.sheetName === sheetName; }) || null; }
function refreshFileName_(fileId, name) { const state = loadState_(); const f = state.files.find(function (x) { return x.id === fileId; }); if (f && f.name !== name) { f.name = trim_(name, 120); saveState_(state); } }

function publicState_() {
  const s = loadState_();
  return { version: APP_.VERSION, limits: limits_(), files: s.files.map(publicFile_), defaultFileId: s.defaultFileId || '' };
}
function emptyState_() { return { version: 2, files: [], defaultFileId: '', categoryGroups: [] }; }
function loadState_() {
  const raw = PropertiesService.getUserProperties().getProperty(APP_.STATE_KEY);
  if (!raw) return emptyState_();
  try { return normalizeState_(JSON.parse(raw)); } catch (e) { return emptyState_(); }
}
function saveState_(state) {
  const s = normalizeState_(state); const text = JSON.stringify(s);
  if (text.length > APP_.MAX_STATE_CHARS) fail_('STATE_TOO_LARGE', '연결 설정이 너무 많습니다.');
  PropertiesService.getUserProperties().setProperty(APP_.STATE_KEY, text);
}
function normalizeState_(input) {
  const out = emptyState_(); if (!plain_(input)) return out;
  const seen = {};
  (Array.isArray(input.files) ? input.files : []).slice(0, APP_.MAX_FILES).forEach(function (f) {
    if (!plain_(f)) return; const id = String(f.id || '').trim(); if (!/^[A-Za-z0-9_-]{10,200}$/.test(id) || seen[id]) return;
    seen[id] = true; out.files.push({ id: id, name: trim_(f.name || 'Google Sheets', 120) });
  });
  out.defaultFileId = seen[String(input.defaultFileId || '')] ? String(input.defaultFileId) : (out.files[0] ? out.files[0].id : '');
  (Array.isArray(input.categoryGroups) ? input.categoryGroups : []).slice(0, 100).forEach(function (g) {
    if (!plain_(g) || !seen[g.fileId] || !g.sheetName || g.sheetName === APP_.GUIDE_NAME) return;
    const items = [];
    (Array.isArray(g.items) ? g.items : []).slice(0, APP_.MAX_CATEGORIES).forEach(function (x) { const s = trim_(x, 60); if (s && items.indexOf(s) < 0) items.push(s); });
    out.categoryGroups.push({ fileId: String(g.fileId), sheetName: trim_(g.sheetName, 100), items: items });
  });
  return out;
}

function validateRequest_(request) {
  if (!plain_(request)) fail_('INVALID_REQUEST', '요청 형식이 올바르지 않습니다.');
  let text; try { text = JSON.stringify(request); } catch (e) { fail_('INVALID_REQUEST', '요청을 처리할 수 없습니다.'); }
  if (text.length > APP_.MAX_REQUEST_CHARS) fail_('REQUEST_TOO_LARGE', '데이터가 너무 큽니다.');
  if (typeof request.action !== 'string' || request.action.length > 40) fail_('INVALID_ACTION', '요청 종류가 올바르지 않습니다.');
}
function requiredText_(value, label, max) { if (typeof value !== 'string') fail_('INVALID_TEXT', label + ' 값이 올바르지 않습니다.'); const s = value.trim(); if (!s || s.length > max) fail_('INVALID_TEXT', label + ' 값이 올바르지 않습니다.'); return s; }
function safe_(value) {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : '';
  if (typeof value === 'boolean' || value instanceof Date) return value;
  let s = String(value).replace(/\u0000/g, '');
  if (s.length > APP_.MAX_CELL_CHARS) s = s.slice(0, APP_.MAX_CELL_CHARS - 16) + '\n[일부 내용 생략]';
  if (/^\s*[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function listText_(v) { return Array.isArray(v) ? v.map(String).join(', ') : String(v == null ? '' : v); }
function json_(v) { if (typeof v === 'string') return v; try { return JSON.stringify(v); } catch (e) { return ''; } }
function trim_(v, max) { const s = String(v == null ? '' : v).trim(); return s.length > max ? s.slice(0, max) : s; }
function plain_(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function hasOwn_(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
function locked_(fn) { const lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) fail_('BUSY', '다른 작업이 진행 중입니다.'); try { return fn(); } finally { lock.releaseLock(); } }
function ok_(data) { return { ok: true, data: data }; }
function fail_(code, message) { const e = new Error(message); e.ytCode = code; throw e; }

function errorResult_(err) {
  const code = err && err.ytCode ? String(err.ytCode) : 'INTERNAL';
  const messages = {
    INVALID_ACTION: '허용되지 않은 요청입니다.', INVALID_REQUEST: '요청 형식이 올바르지 않습니다.', INVALID_TEXT: '입력값이 올바르지 않습니다.',
    REQUEST_TOO_LARGE: '데이터가 너무 큽니다.', INVALID_SHEETS_URL: 'Google Sheets 링크를 붙여넣어 주세요.', INVALID_FILE_ID: '파일 정보가 올바르지 않습니다.',
    INVALID_VIDEO_ID: '영상 ID가 올바르지 않습니다.', INVALID_SHEET_NAME: '사용할 수 없는 시트 이름입니다.', INVALID_PRIORITY: '중요도 값이 올바르지 않습니다.',
    INVALID_PURPOSE: '활용 목적 값이 올바르지 않습니다.', INVALID_STATUS: '상태 값이 올바르지 않습니다.', INVALID_DUPLICATE_MODE: '중복 처리 방식이 올바르지 않습니다.',
    INVALID_ROW: '수정할 행이 올바르지 않습니다.', FILE_NO_ACCESS: '파일을 열 수 없습니다. 계정 권한을 확인해 주세요.', FILE_NOT_WRITABLE: '파일을 수정할 수 없습니다.',
    FILE_NOT_LINKED: '먼저 파일을 연결해 주세요.', FILE_LIMIT: '연결 파일은 최대 10개입니다.', SHEET_NOT_FOUND: '시트를 찾을 수 없습니다.', SHEET_LIMIT: '데이터 시트는 최대 10개입니다.',
    GUIDE_CONFLICT: '기존 안내 탭을 보호하기 위해 연결을 중단했습니다.', GUIDE_RESERVED: '안내 시트는 저장 대상이 아닙니다.', ROW_LIMIT: '이 시트는 2,000개 한도에 도달했습니다.',
    SCHEMA_MISMATCH: '열 이름/순서가 달라 저장을 중단했습니다.', MULTIPLE_DUPLICATES: '같은 영상이 여러 행에 있습니다.', DUPLICATE_NOT_FOUND: '기존 기록을 찾지 못했습니다.',
    ROW_MISMATCH: '선택한 행과 영상이 일치하지 않습니다.', CATEGORY_LIMIT: '카테고리는 최대 30개입니다.', STATE_TOO_LARGE: '연결 설정이 너무 많습니다.', BUSY: '다른 작업이 진행 중입니다.'
  };
  return { ok: false, error: { code: code, message: messages[code] || '요청을 처리하지 못했습니다.' } };
}
