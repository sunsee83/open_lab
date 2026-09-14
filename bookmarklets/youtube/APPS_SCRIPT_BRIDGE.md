# Apps Script Bridge

이 문서는 `유튜브다운로드`의 Google Apps Script 연결 구조를 설명합니다. 프로젝트 전체 구조와 수정 위치의 단일 기준은 [`PROJECT_INFO.json`](./PROJECT_INFO.json)입니다.

## Google에 고정하는 파일

Google Apps Script 프로젝트 `유튜브다운로드앱_v1`에는 다음 두 항목만 고정으로 둡니다.

```text
apps-script/Code.gs
apps-script/appsscript.json
```

`Code.gs`는 GitHub 원격 런타임을 읽어 실행하는 최소 로더이고, `appsscript.json`은 필요한 OAuth 범위를 명시합니다.

일반 기능 코드는 Apps Script 편집기에 복사하지 않습니다. 실행할 때 고정 로더가 GitHub `main`의 다음 파일을 가져옵니다.

```text
apps-script/runtime/Backend.gs
apps-script/runtime/Transport.gs
ui.html
PROJECT_INFO.json
```

## 승인 범위

현재 고정 매니페스트는 다음 범위만 명시합니다.

```text
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/script.external_request
```

- `spreadsheets`: `SpreadsheetApp`으로 Sheets 파일 생성·열기·수정
- `script.external_request`: `UrlFetchApp`으로 GitHub raw 파일 가져오기

## 연결 순서

```text
YouTube 북마클릿
→ 고정 /exec?mode=bridge&origin=...&token=...
→ Google 연결 탭 열림
→ bookmarklet.js가 Google 탭과 하위 frame에 YTDL_BRIDGE_HELLO 반복 전송
→ Transport.gs가 origin + token 검증
→ HELLO의 event.source를 실제 YouTube 통신 창으로 채택
→ YTDL_BRIDGE_READY + ui.html 전달
→ bookmarklet.js가 Blob iframe으로 UI 표시
```

`window.top.opener`는 호환용 fallback일 뿐, 연결의 필수 조건으로 두지 않습니다. Android Whale에서 opener가 사라지는 경우에도 HELLO를 받은 `event.source`로 연결할 수 있게 합니다.

READY가 도착하면 북마클릿은 HELLO 반복 전송을 중지하고, 이후 RPC는 READY를 보낸 실제 창과 origin에 고정합니다.

## Google RPC

```text
ui.html
→ parent.__YTDL_CALL(action, payload)
→ bookmarklet.js
→ YTDL_BRIDGE_REQUEST
→ Google 연결 탭
→ google.script.run.dispatch(request)
→ 고정 Code.gs dispatch
→ GitHub Backend.gs dispatch
→ SpreadsheetApp
→ YTDL_BRIDGE_RESPONSE
→ ui.html
```

OAuth access/refresh token을 북마클릿이나 GitHub에 저장하지 않습니다. Sheets REST API를 YouTube 페이지에서 직접 호출하지도 않습니다.

## GitHub 변경이 바로 반영되는 범위

다음 파일은 GitHub 수정 후 일반적으로 Apps Script 재복사·재배포가 필요 없습니다.

```text
ui.html
apps-script/runtime/Backend.gs
apps-script/runtime/Transport.gs
PROJECT_INFO.json
```

다음 두 파일 자체를 바꾸는 경우에만 Google 쪽 고정본을 다시 반영하고 기존 웹앱 배포를 새 버전으로 갱신합니다.

```text
apps-script/Code.gs
apps-script/appsscript.json
```

`bookmarklet.js`는 브리지 계약이나 웹앱 주소가 바뀌는 경우에만 Whale 북마크에서 교체하는 것을 원칙으로 합니다.

## 보안

GitHub `main`의 원격 런타임은 Apps Script의 사용자 Google 권한으로 실행됩니다.

- 저장소 쓰기 권한을 최소화합니다.
- GitHub 계정 보안을 유지합니다.
- 공개 저장소에 Google OAuth 토큰·비밀번호·개인 키를 넣지 않습니다.
- `Code.gs`는 고정 `sunsee83/open_lab` 경로만 가져옵니다.
- `Transport.gs`는 허용된 YouTube origin과 실행 token을 확인합니다.

## 고정 웹앱 주소

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

이 주소는 바꾸지 않는 것을 원칙으로 합니다.
