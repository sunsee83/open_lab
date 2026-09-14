# Apps Script 브리지

이 문서는 모바일 북마클릿 `유튜브다운로드`와 독립형 Apps Script `유튜브다운로드앱_v1` 사이의 현재 통신 규격입니다.

## 1. Apps Script 파일

```text
유튜브다운로드앱_v1
├─ Code.gs
├─ Transport.gs
└─ ui.html
```

공용 웹앱 주소:

```text
https://script.google.com/macros/s/AKfycbxj-jUt6mYeQMKqIR5d0hloyP7NqbBlZUwjbmctPovwxmApqWuius0WGpdsn21aMuOx/exec
```

웹 앱은 `웹 앱에 액세스하는 사용자`로 실행하고 액세스 대상은 `Google 계정이 있는 모든 사용자`입니다.

## 2. 현재 연결 구조

Google 인증이 필요한 Apps Script를 YouTube 안의 숨은 iframe에서 호출하지 않습니다. 모바일 브라우저의 서드파티 쿠키 제한 때문에 승인 후에도 숨은 iframe 인증이 반복 실패할 수 있기 때문입니다.

```text
YouTube
→ 북마클릿 실행
→ 즉시 별도 Google 연결 탭 생성
→ form POST mode=bridge
→ Transport.gs
→ 인증된 top-level Apps Script 연결 페이지
→ ui.html 원본 + google.script.run 브리지 준비
→ postMessage로 YouTube에 UI 원본 전달
→ YouTube가 Blob URL UI iframe 생성
```

`iframe.srcdoc`은 사용하지 않습니다. UI 문서는 YouTube 페이지가 만든 Blob URL을 사용합니다.

## 3. 최초 Google 승인

최초 미승인 계정은 연결 탭에서 Google 승인을 진행합니다.

```text
유튜브다운로드 실행
→ Google 연결 탭이 즉시 열림
→ Google 승인
→ 승인 완료 안내
→ 승인 탭 닫기
→ 기존 YouTube 탭에서 유튜브다운로드 다시 실행
```

승인 여부를 확인하려고 15초 동안 숨은 iframe 응답을 기다리거나, 현재 YouTube 탭을 승인 페이지로 이동시키지 않습니다.

## 4. 승인 이후 실행

이미 승인된 계정은 연결 탭이 `mode=bridge`를 바로 처리합니다.

```text
Transport.gs
→ bridgeTopHtml_()
→ Apps Script HTML Service sandbox
→ 실제 sandbox window가 YouTube opener에 YTDL_BRIDGE_READY 전송
→ 북마클릿이 sender window + Google origin + 실행 token 고정
→ UI 표시
```

Apps Script HTML Service는 내부 sandbox iframe을 사용하므로 연결 코드는 `window.top.opener`를 통해 원래 YouTube 창을 찾습니다. YouTube 쪽은 최초 READY를 보낸 실제 sender window를 이후 브리지 채널로 고정합니다.

연결 탭은 UI가 실행되는 동안 Apps Script RPC를 처리하므로 닫지 않습니다. `유튜브다운로드`를 닫을 때 함께 종료를 시도합니다.

## 5. Apps Script RPC

UI가 Sheets 작업을 요청하면:

```text
ui.html
→ parent.__YTDL_CALL(action, payload)
→ YTDL_BRIDGE_REQUEST
→ Google 연결 탭
→ google.script.run.bridgeTopDispatch(...)
→ bridgeDispatch_()
→ Code.gs dispatch()
→ YTDL_BRIDGE_RESPONSE
→ YouTube
→ ui.html
```

지원 action:

```text
Transport 전용
- create-storage
- get-ui (호환용)

Code.gs
- ping
- get-state
- connect-file
- unlink-file
- list-sheets
- create-sheet
- list-categories
- add-category
- check-duplicate
- save-record
```

브라우저에서 Google Sheets REST API를 직접 호출하지 않으며 OAuth access/refresh token을 북마클릿이나 GitHub에 저장하지 않습니다.

## 6. UI origin과 CSP

`ui.html` 원본은 Apps Script 연결 탭에서 YouTube로 전달되고, YouTube가 Blob URL을 생성해 iframe에 표시합니다.

YouTube CSP를 따르기 위해 현재 페이지의 script nonce가 있으면 첫 `<style>`과 UI 시작 `<script>`에 동일 nonce를 적용합니다. `srcdoc`은 Trusted Types 문제 때문에 사용하지 않습니다.

Blob UI는 YouTube와 같은 origin 문맥을 사용하므로 기존 `ui.html`의 `parent.document`, `parent.location`, `parent.fetch`, `parent.__YTDL_CALL` 인터페이스를 유지합니다.

## 7. 로컬 저장

파일 선택은 사용자 클릭의 transient activation을 보존해야 합니다. Blob UI는 picker 호출을 상위 YouTube window의 File System Access API로 동기 위임합니다.

```text
사용자 [저장]
→ parent.showSaveFilePicker() 또는 parent.showDirectoryPicker()
→ 실제 FileSystemHandle 확보
→ ui.html 기존 saveLocal()
```

실제 파일 핸들, 미디어 URL, 인증정보는 실행 메모리에만 두고 영구 저장하지 않습니다.

## 8. 보안 검증

- YouTube origin은 Code.gs 허용 목록과 일치해야 함
- 연결 페이지는 실행 token을 검증함
- Google 실행 origin은 `script.google.com`, `script.googleusercontent.com`, `*-script.googleusercontent.com` 계열만 허용
- 최초 READY 이후 실제 sender window와 origin을 고정
- Apps Script 작업은 승인된 top-level 연결 탭의 `google.script.run`으로만 실행

## 9. 북마클릿 크기

Android Whale 배포용 `bookmarklet.js`는 5,000자 이내를 하드 제한으로 관리합니다. 기능 코어는 `ui.html`, `Transport.gs`, `Code.gs`에 유지하고 북마클릿은 연결/표시 역할만 담당합니다.
