# 유튜브다운로드

Android Whale의 YouTube 페이지에서 실행하는 북마클릿 프로젝트입니다.

이 프로젝트는 일반적인 “북마클릿 파일 하나”보다 구성요소가 많기 때문에, **구조 설명의 단일 원본(Single Source of Truth)** 을 별도로 둡니다.

> **프로젝트 구조·역할·수정 위치의 기준:** [`PROJECT_INFO.json`](./PROJECT_INFO.json)

`PROJECT_INFO.json`은 GitHub에서 사람이 확인하는 기준이면서, 실행 중 북마클릿의 `ⓘ` 정보 버튼과 Google Apps Script 정보 화면도 같은 내용을 읽어 표시합니다. 구조 설명을 세 군데 따로 관리하지 않습니다.

## 구성요소

```text
Whale 북마크 `유튜브다운로드`
        ↓
bookmarklet.js                 실행 진입점 / Google 연결 / UI 표시
        ↓
Google Apps Script `유튜브다운로드앱_v1`
        ↓
apps-script/Code.gs            고정 최소 로더 (Google에 최초 1회만 설치)
        ↓  실행할 때 GitHub에서 최신 코드 읽기
GitHub main
├─ apps-script/runtime/Backend.gs    Sheets 저장 로직
├─ apps-script/runtime/Transport.gs  Google 브리지
├─ ui.html                           UI + YouTube 추출/저장
└─ PROJECT_INFO.json                 프로젝트 구조 정보 원본
        ↓
Google Sheets `유튜브다운로드sheet_v1`
```

## 핵심 관리 원칙

### GitHub = 실제 코드 원본

일반 기능 수정은 GitHub에서 합니다.

- 화면/UI, YouTube 추출, 로컬·Drive 처리 → `ui.html`
- Google Sheets 저장 규칙 → `apps-script/runtime/Backend.gs`
- Google 연결/브리지 → `apps-script/runtime/Transport.gs`
- 북마클릿 시작 동작 → `bookmarklet.js`
- 프로젝트 구조 설명 → `PROJECT_INFO.json`

GitHub의 위 파일을 수정하면 **다음 실행부터 Apps Script가 최신 코드를 읽습니다.** 일반 기능 변경 때문에 Apps Script에 다시 복사·붙여넣기하거나 새 버전을 배포하지 않습니다.

### Apps Script = 고정 로더 + Google 권한

Google Apps Script 프로젝트 `유튜브다운로드앱_v1`에는 원칙적으로 [`apps-script/Code.gs`](./apps-script/Code.gs) 하나만 유지합니다.

이 파일은 GitHub의 실제 런타임을 가져와 Google 권한으로 실행하는 고정 로더입니다. 따라서 **GitHub 저장소 위치나 로더 계약 자체를 바꿀 때만** Google 쪽 `Code.gs`를 다시 갱신하고 기존 웹앱을 재배포합니다.

공용 웹앱 주소는 계속 동일하게 유지합니다.

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

## 실행 흐름

```text
YouTube
→ 북마클릿 실행
→ 별도 Google 연결 탭에서 Apps Script /exec 실행
→ 고정 Loader가 GitHub Backend.gs + Transport.gs 로드
→ Transport가 GitHub ui.html 로드
→ ui.html을 YouTube의 Blob iframe으로 표시
→ Sheets 요청은 google.script.run → Loader dispatch → GitHub Backend → SpreadsheetApp
```

숨은 iframe 안에서 Google 인증을 시도하지 않고, 별도의 top-level Google 연결 탭을 사용합니다.

## 나중에 구조가 기억나지 않을 때

세 곳에서 같은 정보를 확인할 수 있습니다.

- **북마클릿 실행 후:** 우측 상단 `ⓘ`
- **Apps Script 웹앱 주소 직접 열기:** 프로젝트 정보 화면
- **GitHub:** `PROJECT_INFO.json`

세 화면의 기준 데이터는 모두 `PROJECT_INFO.json`입니다.

## 보안상 중요한 점

Apps Script 고정 로더는 공개 GitHub `main` 브랜치의 런타임을 가져와 **사용자의 Google 권한으로 실행**합니다. 따라서 `sunsee83/open_lab`의 쓰기 권한과 GitHub 계정 보안이 곧 배포 보안입니다. 모르는 사람에게 저장소 쓰기 권한을 주면 안 됩니다.

## 북마클릿 제한

Android Whale에 저장하는 `bookmarklet.js`는 **5,000자 이내**를 하드 제한으로 유지합니다.

세부 구조는 README를 복사해 다른 문서에 중복 작성하지 않고 `PROJECT_INFO.json`을 기준으로 확인합니다.
