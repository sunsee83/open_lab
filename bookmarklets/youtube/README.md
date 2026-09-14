# 유튜브다운로드

Android Whale의 YouTube 페이지에서 실행하는 북마클릿 프로젝트입니다.

이 프로젝트는 북마클릿·GitHub·Google Apps Script·Google Sheets가 연결되어 있으므로, **구조 설명의 단일 원본(Single Source of Truth)** 을 [`PROJECT_INFO.json`](./PROJECT_INFO.json)으로 유지합니다.

## 전체 구조

```text
Whale 북마크 `유튜브다운로드`
        ↓
bookmarklet.js
고정에 가까운 실행/연결 bootstrap
        ↓ HELLO 반복 전송
Google Apps Script `유튜브다운로드앱_v1`
├─ Code.gs                 고정 GitHub 원격 로더
└─ appsscript.json         고정 OAuth 범위
        ↓ 실행 때 최신 코드 읽기
GitHub main
├─ apps-script/runtime/Backend.gs    Sheets 저장 로직
├─ apps-script/runtime/Transport.gs  Google 브리지
├─ ui.html                           UI + YouTube 추출/저장
└─ PROJECT_INFO.json                 프로젝트 구조 정보 원본
        ↓
Google Sheets `유튜브다운로드sheet_v1`
```

## 평소 어디를 수정하는가

| 바꾸려는 내용 | 수정 위치 |
| --- | --- |
| 화면 / YouTube 정보 추출 / 로컬·Drive 처리 | `ui.html` |
| Sheets 저장 규칙 | `apps-script/runtime/Backend.gs` |
| Google 브리지 | `apps-script/runtime/Transport.gs` |
| 전체 구조 설명 | `PROJECT_INFO.json` |
| 브리지 시작 계약 자체 | `bookmarklet.js` |
| Google 원격 로더 자체 | `apps-script/Code.gs` |
| Google OAuth 범위 | `apps-script/appsscript.json` |

일반 기능 수정은 GitHub에서만 합니다. `ui.html`, `Backend.gs`, `Transport.gs` 변경은 **Apps Script에 다시 복사하거나 웹앱을 다시 배포하지 않아도 다음 실행부터 반영**되는 것을 원칙으로 합니다.

## Google Apps Script에 고정하는 것

Google Apps Script 프로젝트 `유튜브다운로드앱_v1`에는 다음 두 항목만 고정으로 유지합니다.

```text
Code.gs
appsscript.json
```

`appsscript.json`은 원격 Backend가 사용하는 Sheets 읽기/쓰기 범위와 GitHub 원격 코드를 가져오기 위한 외부 요청 범위를 명시합니다.

공용 웹앱 주소는 바꾸지 않습니다.

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

## 실행 흐름

```text
YouTube에서 북마클릿 실행
→ 별도 Google 연결 탭 열기
→ 북마클릿이 Google 탭/하위 frame에 YTDL_BRIDGE_HELLO 반복 전송
→ Transport.gs가 정상 origin + token의 HELLO를 받으면 event.source를 통신 상대방으로 고정
→ YTDL_BRIDGE_READY + 최신 ui.html 전달
→ YouTube에 Blob iframe UI 표시
→ UI RPC → Google 탭 → google.script.run → Backend.gs → SpreadsheetApp
```

`window.opener`만 믿지 않습니다. opener가 유지되면 빠른 fallback으로 사용할 수 있지만, 실제 연결은 HELLO를 보낸 `event.source`를 기준으로 잡을 수 있게 되어 있습니다.

## 나중에 구조가 기억나지 않을 때

- 실행 화면의 `ⓘ`
- Apps Script 웹앱 정보 화면
- GitHub의 `PROJECT_INFO.json`

세 곳의 기준 정보는 `PROJECT_INFO.json`입니다.

## 관리 원칙

- 북마클릿은 5,000자 이내를 유지합니다.
- 북마클릿은 일반 기능 코드를 누적하지 않고 실행·연결 bootstrap 역할에 집중합니다.
- GitHub Actions나 자동 배포 비밀키 체계는 사용하지 않습니다.
- 공개 GitHub에 Google OAuth 토큰·비밀번호·개인 키를 저장하지 않습니다.
- GitHub `main`의 원격 런타임은 사용자의 Google 권한으로 실행되므로 저장소 쓰기 권한과 계정 보안을 보호해야 합니다.

세부 구조와 수정 기준은 항상 [`PROJECT_INFO.json`](./PROJECT_INFO.json)을 우선합니다.
