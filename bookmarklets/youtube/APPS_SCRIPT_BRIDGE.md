# Apps Script Bridge

이 문서는 `유튜브다운로드`의 Google Apps Script 연결 구조를 설명합니다. 프로젝트 전체 구조와 수정 위치의 단일 기준은 [`PROJECT_INFO.json`](./PROJECT_INFO.json)입니다.

## 현재 원칙

Google Apps Script 프로젝트 `유튜브다운로드앱_v1`에는 **고정 최소 로더 `apps-script/Code.gs`만 설치**합니다.

일반 기능 코드는 Apps Script 편집기에 복사하지 않습니다. 실행할 때 고정 로더가 GitHub `main`의 다음 파일을 가져와 실행합니다.

```text
apps-script/runtime/Backend.gs
apps-script/runtime/Transport.gs
ui.html
PROJECT_INFO.json
```

따라서 UI·Sheets 저장·Google 브리지 같은 일반 기능을 수정할 때는 GitHub만 수정합니다. Apps Script 재복사·재배포는 필요하지 않습니다.

## 실행 경로

```text
YouTube 북마클릿
→ 고정 /exec?mode=bridge...
→ Apps Script Code.gs 고정 로더
→ GitHub Backend.gs + Transport.gs 로드/eval
→ Transport.gs가 GitHub ui.html 로드
→ YTDL_BRIDGE_READY
→ bookmarklet.js가 Blob iframe으로 UI 표시
```

UI의 Google 요청은 다음 경로입니다.

```text
ui.html
→ parent.__YTDL_CALL(action, payload)
→ bookmarklet.js postMessage
→ Google 연결 탭
→ google.script.run.dispatch(request)
→ Apps Script 고정 Code.gs dispatch
→ GitHub Backend.gs dispatch
→ SpreadsheetApp
```

## 왜 이렇게 구성하는가

기존에는 `Code.gs`, `Transport.gs`, `ui.html`을 Google Apps Script에 매번 복사하고 웹앱 새 버전을 배포해야 했습니다. 이 방식은 수정 빈도가 높을수록 실수와 버전 불일치가 발생하기 쉽습니다.

현재 구조에서는 Google 쪽 코드를 **거의 변하지 않는 로더**로 고정하고, 자주 바뀌는 실제 코드를 GitHub 하나에서 관리합니다.

## Google에 다시 붙여넣어야 하는 경우

다음 경우에만 `apps-script/Code.gs`를 Google에 다시 반영하고 기존 웹앱을 새 버전으로 배포합니다.

- GitHub 저장소/브랜치/경로 자체가 바뀜
- 원격 런타임 로딩 방식이 바뀜
- Apps Script의 top-level `doGet` 또는 `dispatch` 계약이 바뀜
- Google 권한 모델 자체를 바꿈

단순한 UI 수정, Sheets 컬럼/저장 로직 수정, 댓글/자막 처리 수정, 브리지 내부 수정은 여기에 해당하지 않습니다.

## 프로젝트 정보 공유

`PROJECT_INFO.json`을 세 위치에서 같이 사용합니다.

```text
GitHub             → PROJECT_INFO.json 직접 확인
북마클릿 실행 UI    → ⓘ → dispatch('project-info')
Apps Script /exec  → PROJECT_INFO.json을 읽어 정보 페이지 표시
```

구조 설명을 각 파일에 장문으로 중복 작성하지 않습니다. 각 구성요소에는 `PROJECT_INFO.json` 위치를 가리키는 짧은 주석만 남깁니다.

## 보안

이 구조는 GitHub `main`의 코드를 Apps Script의 Google 권한으로 실행합니다. 따라서 GitHub 저장소에 쓰기 권한이 있는 계정은 사실상 Apps Script 실행 코드를 변경할 수 있습니다.

- 저장소 쓰기 권한을 최소화합니다.
- GitHub 계정에 강한 인증을 사용합니다.
- 공개 저장소에 Google OAuth 토큰·비밀번호·개인 키를 저장하지 않습니다.
- `Code.gs` 로더는 `sunsee83/open_lab`의 고정 경로만 가져오도록 제한합니다.

## 고정 웹앱

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

이 주소는 바꾸지 않는 것을 원칙으로 합니다.
