# 유튜브다운로드

Android Whale의 YouTube 페이지에서 영상·음성·데이터를 로컬 또는 Google 저장공간에 저장하는 북마클릿입니다.

## 고정 이름

- Whale 북마크: `유튜브다운로드`
- Apps Script: `유튜브다운로드앱_v1`
- Google Sheets: `유튜브다운로드sheet_v1`
- 웹앱: `https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec`

## 구조

```text
bookmarklet.js
  → Google Apps Script (Code.gs + appsscript.json)
  → GitHub runtime (Transport.gs + Backend.gs) + ui.html
  → Google Sheets
```

- `bookmarklet.js`: 실행, HELLO/READY, RPC, UI 표시
- `ui.html`: 화면, YouTube 추출, 로컬/Drive 저장
- `apps-script/runtime/Transport.gs`: Google 연결/RPC
- `apps-script/runtime/Backend.gs`: Sheets 저장
- `apps-script/Code.gs`: 고정 GitHub 로더
- `apps-script/appsscript.json`: OAuth 범위
- `PROJECT_INFO.json`: 실행 화면 `ⓘ`와 Apps Script가 읽는 구조 정보
- `SHEET_RULES.md`: Sheets 규칙

## 연결 원칙

Google 웹앱은 **웹 앱에 액세스하는 사용자 권한**으로 실행합니다. 비밀키·익명 배포 방식은 사용하지 않습니다.

YouTube와 Google 탭은 `YTDL_BRIDGE_HELLO → event.source → READY`로 연결합니다. `window.opener`에 의존하지 않습니다.

## 수정 규칙

`ui.html`, `Backend.gs`, `Transport.gs`, `PROJECT_INFO.json`은 GitHub 수정 후 다음 실행부터 반영됩니다.

`Code.gs` 또는 `appsscript.json`을 바꾼 경우에만 Apps Script에 다시 반영하고 **기존 웹앱 배포를 새 버전으로 갱신**합니다. `bookmarklet.js`는 웹앱 주소나 브리지 계약이 바뀔 때만 Whale에서 교체하며 5,000자 이하를 유지합니다.

GitHub `main`의 runtime은 사용자의 Google 권한으로 실행되므로 저장소 쓰기 권한과 계정 보안을 보호합니다. OAuth 토큰·비밀번호·개인 키는 저장소에 넣지 않습니다.

## 완료 기준

Android Whale에서 북마클릿 한 번 실행 후 다음을 실제로 확인합니다: UI 표시, Sheets 저장, 중복 업데이트, 로컬 영상/음성 저장, Drive 저장, 브라우저를 닫았다가 다시 실행했을 때 재사용.

영상/음성의 Drive 저장은 Google Save to Drive 버튼을 사용하므로 **버튼 표시가 아니라 사용자가 버튼을 눌러 실제 저장된 것까지** 확인해야 합니다.
