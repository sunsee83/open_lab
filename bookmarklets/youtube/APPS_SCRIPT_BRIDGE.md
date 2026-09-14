# Apps Script 브리지

이 문서는 모바일 북마클릿 `유튜브다운로드`와 독립형 Apps Script `유튜브다운로드앱_v1` 사이의 현재 통신 규격입니다.

## 1. Apps Script 파일

```text
유튜브다운로드앱_v1
├─ Code.gs
├─ Transport.gs
└─ ui.html
```

`ui.html`은 GitHub의 `bookmarklets/youtube/ui.html`과 같은 원본을 Apps Script의 HTML 파일 `ui`에 복사합니다.

## 2. 공용 엔드포인트

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

이 주소는 공용 Apps Script 웹앱 주소이며 개인 Sheets 주소가 아닙니다.

## 3. 브리지 구성

북마클릿은 두 iframe과 상위 페이지 action bar를 사용합니다.

```text
숨은 bridge iframe
→ init / request POST
→ Apps Script action 응답 수신

화면 UI iframe
→ mode=ui POST의 target
→ Transport.gs가 ui.html을 HTML Service로 직접 표시

상위 YouTube 문서 action bar
→ 실제 저장 / 닫기 클릭
→ File System Access API의 user activation 보존
```

UI는 `srcdoc`이나 Blob URL로 생성하지 않습니다.

## 4. 세션

```text
init
→ origin + token + requestId 검증
→ 사용자별 bridgeNonce 발급

request
→ origin + token + requestId + bridgeNonce 검증
→ action 실행

ui
→ origin + token + requestId + bridgeNonce 검증
→ ui.html 표시
```

- nonce 유효시간: 10분
- nonce 저장: `PropertiesService.getUserProperties()`
- OAuth access/refresh token을 북마클릿에 전달하지 않음
- 허용 YouTube origin만 연결 가능

## 5. Apps Script HTML 실행 origin

HTML Service의 실제 클라이언트 스크립트는 다음과 같은 동적 origin에서 실행될 수 있습니다.

```text
https://n-...-script.googleusercontent.com
```

따라서 북마클릿은 `script.google.com`, `script.googleusercontent.com`, `*-script.googleusercontent.com` 계열의 HTTPS origin만 허용하고 실행 token을 함께 검증합니다.

일반 POST 응답은 숨은 bridge iframe의 `contentWindow`까지 확인합니다. UI는 최초 `YTDL_UI_READY`가 화면 iframe의 `contentWindow`에서 온 경우에만 승인하고, 이후 sender window와 origin을 현재 실행의 UI 채널로 고정합니다.

## 6. UI 호스트 프록시

Apps Script UI는 YouTube 페이지와 cross-origin입니다. UI가 필요한 브라우저 기능은 `postMessage`로 YouTube 상위 페이지의 고정 로더에 요청합니다.

```text
YTDL_UI_READY
→ YTDL_HOST_INIT
→ YouTube URL/메타데이터/ytcfg 전달

YTDL_HOST_REQUEST
→ 허용된 호스트 기능 실행
→ YTDL_HOST_RESPONSE
```

일반 호스트 action:

```text
gas         Apps Script action 호출
fetch       허용된 YouTube HTTPS 요청
dir-file    이미 선택한 폴더 안 파일 핸들 생성
write-text  텍스트 파일 기록
write-media GoogleVideo 스트림 기록
open        HTTPS 페이지 열기
close       현재 유튜브다운로드 종료
```

YouTube 쿠키나 OAuth token 자체를 UI에 전달하지 않습니다.

## 7. 로컬 저장 activation 채널

파일/폴더 선택은 일반 `YTDL_HOST_REQUEST`로 처리하지 않습니다. UI가 먼저 현재 저장 계획을 상위 페이지에 동기화합니다.

```text
YTDL_SAVE_PLAN
→ target / types / 파일명 / picker 옵션 / busy 상태
```

사용자가 상위 YouTube 문서의 실제 `[저장]` 버튼을 누르면 같은 click handler 안에서 즉시:

```text
단일 항목 → showSaveFilePicker()
복수 항목 → showDirectoryPicker()
```

를 호출합니다. handle을 확보한 뒤에만 다음 메시지를 UI로 보냅니다.

```text
YTDL_HOST_SAVE {local:{fileId}}
또는
YTDL_HOST_SAVE {local:{dirId}}
```

Transport가 넣는 shim은 이 임시 handle ID를 기존 `ui.html`의 `showSaveFilePicker()` / `showDirectoryPicker()` 호출 결과처럼 제공하므로 `saveLocal()` 코어를 바꾸지 않습니다.

이 구조는 cross-origin iframe의 클릭을 `postMessage`한 뒤 picker를 호출하면서 transient user activation이 사라지는 문제를 피하기 위한 고정 규칙입니다.

## 8. Apps Script action

Transport 전용:

```text
create-storage
```

현재 고정 로더의 화면 표시는 `mode=ui`를 사용합니다. `get-ui` action은 이전 호출과의 호환을 위해 남아 있지만 최종 표시 경로에서는 사용하지 않습니다.

Code.gs action:

```text
ping
get-state
connect-file
unlink-file
list-sheets
create-sheet
list-categories
add-category
check-duplicate
save-record
```

## 9. POST 필드

초기화:

```text
mode=init
origin=<YouTube origin>
token=<실행 token>
requestId=<요청 ID>
```

일반 action:

```text
mode=request
origin=<YouTube origin>
token=<실행 token>
requestId=<요청 ID>
bridgeNonce=<init에서 받은 nonce>
request=<JSON 문자열>
```

UI 표시:

```text
mode=ui
origin=<YouTube origin>
token=<실행 token>
requestId=<요청 ID>
bridgeNonce=<init에서 받은 nonce>
```

일반 POST 응답은 `YT_GAS_RESPONSE`의 source window, Google 실행 origin, token, requestId가 모두 일치할 때만 사용합니다.

## 10. Google 승인

웹 앱은 `웹 앱에 액세스하는 사용자`로 실행합니다. 처음 사용하는 Google 계정은 `유튜브다운로드앱_v1`에 대한 승인을 한 번 진행합니다.

```text
최초 미승인 계정
→ 숨은 init POST 응답 없음
→ 고정 로더가 승인 페이지 이동 여부 확인
→ 공용 /exec를 현재 탭에서 열어 Google 승인
→ doGet() 승인 완료 안내
→ YouTube로 돌아감
→ 유튜브다운로드 다시 실행
```

승인 이후 데이터 통신은 숨은 iframe POST 브리지를 사용합니다. `window.opener`와 브라우저 직접 Sheets REST API는 사용하지 않습니다.
