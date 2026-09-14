# YouTube 영상·음성 Drive 저장

이 문서는 영상/음성을 Google Drive에 저장하는 현재 미디어 경로를 정의합니다.

데이터의 Google Sheets 저장은 이 경로와 별개이며 `Apps Script + SpreadsheetApp`을 사용합니다.

## 1. 영상/음성 Drive 구조

```text
ui.html
→ Android player 응답에서 선택 미디어 URL/파일명 준비
→ Google 공식 Save to Drive 버튼 렌더링
→ 사용자가 공식 버튼을 누름
→ My Drive 저장
```

Apps Script UI가 Save to Drive 버튼을 직접 렌더링합니다.

## 2. 데이터 Drive 구조

```text
ui.html collect()
→ host gas 요청
→ YouTube 상위 페이지의 숨은 Apps Script POST bridge
→ save-record
→ Code.gs
→ SpreadsheetApp
→ 사용자가 연결한 Sheets
```

영상/음성 Drive와 Sheets 데이터 저장 경로를 혼합하지 않습니다.

## 3. 미디어 URL 보관

실제 YouTube 미디어 URL은 `ui.html`의 현재 실행 메모리에만 보관합니다.

```text
player()
→ media.video / media.audio Map
→ 사용자가 고른 후보 확인
→ gapi.savetodrive.render()의 src로 전달
```

실제 URL은 localStorage, IndexedDB, GitHub 파일, Sheets 문서에 저장하지 않습니다.

## 4. UI 처리

사용자가 Drive 저장을 실행하면:

```text
선택 미디어 URL 확인
→ window.___gcfg.parsetags = explicit
→ https://apis.google.com/js/platform.js 로드
→ gapi.savetodrive.render()
→ 영상/음성별 공식 저장 버튼 렌더링
```

선택 화질/음질, 선택 항목, 저장 위치가 바뀌면 이전 준비 상태를 무효화합니다.

## 5. Google 공식 Save to Drive 범위

이 방식은 Drive API 직접 업로드가 아닙니다.

- 별도 OAuth Client ID/API Key를 북마클릿에 넣지 않음
- Google 브라우저 세션 사용
- 대상은 `My Drive`
- 특정 Drive 폴더를 프로그램으로 지정하지 않음
- 사용자가 수집도구의 `[저장]` 후 Google 공식 저장 버튼을 한 번 더 누름
- 공식 버튼 렌더링은 저장 완료가 아니라 저장 준비 상태

따라서 Sheets의 `파일 → 시트 → 카테고리` 선택 구조는 영상/음성 Drive 버튼에 적용하지 않습니다.

## 6. 복수 선택

영상과 음성을 함께 선택하면 각각 독립된 Google 저장 버튼을 렌더링합니다.

```text
영상 [Google Drive에 저장]
음성 [Google Drive에 저장]
```

한 항목 실패가 다른 항목에 영향을 주지 않습니다.

## 7. 실패 처리

- Google 스크립트 로드 실패 → 해당 Drive 버튼만 실패
- 미디어 URL 조건 불충족 → 해당 항목만 실패
- Drive 버튼 실패 → Sheets/로컬 경로에 영향 없음

GoogleVideo 스트림의 실제 Save to Drive 성공 여부는 브라우저/CORS/Range 조건에 영향을 받을 수 있습니다.

Google 공식 Save to Drive 규격상 외부 원본 서버의 응답 조건을 만족해야 하므로 버튼 생성 시점을 실제 파일 생성 완료로 판정하지 않습니다.

Android Whale 최종 검증에서는 버튼 표시와 실제 My Drive 파일 생성 여부를 별도로 확인합니다.

UI 동작은 `UI_SPEC.md`, 메시지 형식은 `PROTOCOL.md`를 따릅니다.