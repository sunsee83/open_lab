# 유튜브다운로드

Android 모바일 YouTube용 **단일 북마클릿** 프로젝트입니다. 이 문서는 현재 구조의 기준입니다.

## 1. 이름 체계

```text
모바일 북마클릿 이름  유튜브다운로드
Apps Script 프로젝트  유튜브다운로드앱_v1
Google Sheets 파일     유튜브다운로드sheet_v1
```

## 2. 최종 실행 구조

```text
Android Whale / YouTube
└─ 북마크 유튜브다운로드
   └─ bookmarklet.js
      ├─ Google 연결 탭 즉시 생성
      ├─ mode=bridge POST
      ├─ Apps Script 연결 탭과 postMessage 채널 고정
      ├─ 전달받은 ui.html을 Blob iframe으로 표시
      └─ __YTDL_CALL로 Google 작업 전달
           ↓
별도 Google 연결 탭
└─ Apps Script HTML Service
   ├─ Google 승인 세션 유지
   ├─ google.script.run
   └─ Transport.gs → Code.gs
```

숨은 iframe에서 Google 인증을 시도하지 않습니다. 모바일 브라우저의 서드파티 쿠키 제한 때문에 승인 후에도 인증이 반복 실패할 수 있기 때문입니다.

최초 미승인 사용자는 별도 Google 연결 탭에서 승인한 뒤 그 탭을 닫고 기존 YouTube 탭에서 `유튜브다운로드`를 한 번 더 실행합니다. 현재 YouTube 탭을 승인 페이지로 이동시키지 않습니다.

## 3. Apps Script 구조

Google Sheets에 바인딩하지 않는 독립형 프로젝트입니다.

```text
유튜브다운로드앱_v1
├─ Code.gs       SpreadsheetApp / 데이터 처리
├─ Transport.gs  top-level Google 브리지 / google.script.run
└─ ui.html       UI + YouTube 추출 + 저장 코어
```

공용 웹앱 주소:

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

## 4. UI 표시

Apps Script 연결 탭이 `ui.html` 원본을 YouTube opener로 전달합니다.

```text
Transport.gs
→ YTDL_BRIDGE_READY + ui.html
→ bookmarklet.js
→ Blob URL 생성
→ YouTube 페이지의 전체화면 iframe
```

`iframe.srcdoc`은 Trusted Types 문제 때문에 사용하지 않습니다. YouTube CSP를 따르기 위해 가능한 경우 현재 페이지의 script nonce를 첫 UI style/script에 적용합니다.

## 5. Google RPC

UI의 Sheets 작업은 다음 경로를 사용합니다.

```text
ui.html
→ parent.__YTDL_CALL
→ YouTube ↔ Google 연결 탭 postMessage
→ google.script.run.bridgeTopDispatch
→ Code.gs dispatch
→ SpreadsheetApp
```

OAuth access/refresh token을 북마클릿이나 GitHub에 저장하지 않고 브라우저에서 Sheets REST API도 직접 호출하지 않습니다.

## 6. 저장 경로

```text
데이터 + Drive
ui.html → Google 연결 탭 → Apps Script → SpreadsheetApp

영상/음성 + 로컬
ui.html → parent File System Access API → YouTube fetch → Android 파일

데이터 + 로컬
ui.html → parent File System Access API → TXT/JSON/원문 파일

영상/음성 + Drive
ui.html → Google 공식 Save to Drive 버튼
```

## 7. 기본 Sheets

```text
유튜브다운로드sheet_v1
├─ 안내
└─ 수집
   └─ 기본
```

- 연결 파일 최대 10개
- 데이터 시트 최대 10개
- 시트당 최대 2,000개
- 1,800개부터 한도 경고
- 영상 ID 기준 중복 확인

## 8. 고정 로더 원칙

`bookmarklet.js`에는 UI/댓글/자막/Sheets 규칙을 누적하지 않습니다. 연결과 UI 표시만 담당하고 일반 기능 수정은 Apps Script 파일에서 처리합니다.

Android Whale 배포용 `bookmarklet.js`는 **5,000자 이내를 하드 제한**으로 유지합니다.

## 9. 기준 파일

- `bookmarklet.js` : Google 연결 탭 + UI 로더
- `ui.html` : 통합 UI + YouTube 추출 + 로컬/Drive 저장 코어
- `apps-script/Transport.gs` : top-level Google 브리지 + 저장공간 생성
- `apps-script/Code.gs` : Sheets 구조와 데이터 저장
- `APPS_SCRIPT_BRIDGE.md` : 북마클릿 ↔ Apps Script 규격
- `CORE_SPEC.md` : 실행 코어 책임
- `UI_SPEC.md` : 화면 규격
- `SHEET_RULES.md` : Sheets 저장 규칙
- `GOOGLE_SETUP_FLOW.md` : 사용자별 Google 저장공간
