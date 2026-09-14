# 유튜브다운로드

Android Whale에서 YouTube 영상·음성·데이터를 로컬 또는 Google 저장공간에 저장하는 북마클릿입니다.

## 구조

```text
Whale bookmarklet.js
  → Google Apps Script (Code.gs + appsscript.json)
  → GitHub runtime (Transport.gs + Backend.gs) / ui.html
  → Google Sheets
```

- `bookmarklet.js`: 실행, HELLO/READY 연결, UI 표시
- `ui.html`: 화면, YouTube 추출, 로컬/Drive 저장
- `apps-script/runtime/Transport.gs`: Google 연결/RPC
- `apps-script/runtime/Backend.gs`: Sheets 저장
- `apps-script/Code.gs`: 고정 GitHub 로더
- `apps-script/appsscript.json`: 고정 OAuth 범위
- `PROJECT_INFO.json`: 구조 정보 원본
- `SHEET_RULES.md`: Sheets 저장 규칙

## 관리 원칙

일반 기능 수정은 GitHub에서만 합니다. `ui.html`, `Backend.gs`, `Transport.gs` 변경은 Apps Script 재배포가 필요 없습니다.

Google Apps Script `유튜브다운로드앱_v1`에는 `Code.gs`와 `appsscript.json`만 유지합니다. 이 둘을 바꿀 때만 기존 웹앱 배포를 새 버전으로 갱신합니다.

Whale의 `유튜브다운로드` 북마크는 `bookmarklet.js`를 사용하며 5,000자 이하를 유지합니다. 브리지 계약이나 웹앱 주소가 바뀔 때만 교체합니다.

고정 웹앱:
`https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec`

## 완료 기준

Android Whale에서 북마클릿 한 번 실행 후 UI가 열리고, Sheets 저장·중복 업데이트·로컬 영상/음성 저장·Drive 저장이 실제로 완료되어야 합니다.

보안: GitHub `main`의 runtime은 Google 권한으로 실행되므로 저장소 쓰기 권한을 보호합니다.
