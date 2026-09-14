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
      ├─ 숨은 Apps Script POST 브리지 생성
      ├─ init → bridgeNonce 발급
      ├─ 화면용 iframe 생성
      ├─ mode=ui POST로 Apps Script UI 직접 표시
      └─ YouTube 호스트 프록시 제공
           ↓
Apps Script HTML Service iframe
└─ ui.html
   ├─ 통합 UI
   ├─ YouTube 정보/자막/댓글 추출 코어
   ├─ 영상·음성 후보 관리
   ├─ 데이터 수집/출력
   ├─ Sheets 저장 요청
   └─ Google Save to Drive UI
```

YouTube 페이지에서 `iframe.srcdoc`이나 Blob URL로 UI 문서를 만들지 않습니다. 화면용 iframe 자체를 공용 Apps Script `/exec`의 POST 대상(target)으로 사용하고, `Transport.gs`가 `ui.html`을 HTML Service 응답으로 직접 표시합니다.

Apps Script UI는 cross-origin sandbox에서 실행되므로 YouTube 페이지 접근, YouTube `fetch`, File System Access API, Apps Script action 호출은 `bookmarklet.js`의 제한된 호스트 프록시를 통해 처리합니다.

## 3. Apps Script 구조

Google Sheets에 바인딩하지 않는 독립형 프로젝트입니다.

```text
유튜브다운로드앱_v1
├─ Code.gs       SpreadsheetApp / 데이터 처리
├─ Transport.gs  POST 브리지 / nonce / UI 응답 / 호스트 연결
└─ ui.html       UI + YouTube 추출 + 저장 코어
```

공용 웹앱 주소:

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

이 주소는 `bookmarklet.js`의 공용 엔드포인트이며 개인 Sheets 주소가 아닙니다.

## 4. 고정 로더 원칙

`bookmarklet.js`에는 YouTube 추출 규칙, 댓글/자막 파서, Sheets 열 규칙, UI 기능 코드를 넣지 않습니다.

북마클릿에 남기는 역할은 다음으로 제한합니다.

```text
Apps Script 연결
UI iframe 표시
YouTube 페이지 컨텍스트 전달
허용된 YouTube fetch 프록시
로컬 파일 선택/쓰기 프록시
종료/정리
```

일반 기능 수정은 `ui.html`, `Transport.gs`, `Code.gs`를 새 Apps Script 버전으로 배포해 처리하고 공용 `/exec` 주소는 유지합니다.

## 5. 최초 사용자 저장공간

```text
Google 승인
→ YouTube로 복귀 후 유튜브다운로드 실행
→ create-storage
→ 기존 연결이 있으면 재사용
→ 없으면 유튜브다운로드sheet_v1 자동 생성
→ 안내 시트
→ 수집 시트
→ 기본 카테고리
→ UserProperties에 사용자별 연결 저장
```

사용자는 최초 설정에서 Google Sheets를 직접 만들거나 주소를 입력하지 않습니다.

## 6. 저장 경로

```text
데이터 + Drive
ui.html → 호스트 프록시 → POST 브리지 → Apps Script → SpreadsheetApp

영상/음성 + 로컬
ui.html → 호스트 파일 프록시 → YouTube 페이지 fetch → Android 파일 저장

데이터 + 로컬
ui.html → 호스트 파일 프록시 → 원문/TXT/JSON 파일

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

## 8. 기준 파일 책임

- `bookmarklet.js` : 고정 연결/호스트 로더
- `ui.html` : 통합 UI + YouTube 추출 + 로컬/Drive 저장 코어
- `apps-script/Transport.gs` : POST 브리지, nonce, UI HTML 응답, 저장공간 생성
- `apps-script/Code.gs` : Sheets 구조와 데이터 저장
- `APPS_SCRIPT_BRIDGE.md` : 북마클릿 ↔ Apps Script 규격
- `CORE_SPEC.md` : 실행 코어의 실제 배치와 책임
- `UI_SPEC.md` : 화면 규격
- `SHEET_RULES.md` : Sheets 저장 규칙
- `GOOGLE_SETUP_FLOW.md` : 사용자별 Google 저장공간

## 9. 문서 원칙

현재 확정 구조만 기록하며 임시 테스트 코드나 폐기된 구현 이력을 기준 문서에 누적하지 않습니다.