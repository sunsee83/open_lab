# 유튜브다운로드 실행 프로토콜

현재 구조는 YouTube 상위 페이지의 고정 로더와 Apps Script HTML Service의 `ui.html` 사이를 제한된 `postMessage` 프로토콜로 연결합니다.

## 1. 실행 채널

```text
YouTube 페이지
├─ 숨은 bridge iframe
│  └─ init / request POST
└─ 화면 UI iframe
   └─ mode=ui POST → Apps Script ui.html
```

UI iframe은 Apps Script의 cross-origin sandbox에서 실행됩니다.

## 2. 일반 Apps Script 요청

북마클릿 내부 `C(action,payload)`가 다음 순서로 처리합니다.

```text
init
→ bridgeNonce 확보
→ mode=request POST
→ YT_GAS_RESPONSE
→ token + requestId 확인
```

bridgeNonce가 만료되면 한 번 재초기화합니다.

## 3. UI 시작

```text
bookmarklet.js
→ ping
→ 화면 iframe 생성
→ mode=ui POST
→ Transport.gs가 ui.html + 호스트 shim 응답
→ UI: YTDL_UI_READY
→ 호스트: YTDL_HOST_INIT
→ ui.html start()
```

`YTDL_HOST_INIT`에는 현재 영상의 URL/메타데이터와 YouTube 내부 요청에 필요한 최소 컨텍스트만 전달합니다.

## 4. UI → 호스트 요청

```js
{
  type:'YTDL_HOST_REQUEST',
  token:'현재 실행 token',
  id:'요청 ID',
  action:'gas|fetch|pick-file|pick-dir|dir-file|write-text|write-media|open|close',
  payload:{}
}
```

응답:

```js
{
  type:'YTDL_HOST_RESPONSE',
  token:'현재 실행 token',
  id:'요청 ID',
  ok:true,
  data:{}
}
```

실패 시 `ok:false`와 오류 메시지를 반환합니다.

## 5. 호스트 action 경계

### gas

허용된 Apps Script action을 기존 숨은 POST 브리지로 전달합니다.

### fetch

HTTPS YouTube 도메인 요청만 허용합니다.

```text
www.youtube.com
youtube.com
m.youtube.com
music.youtube.com
```

UI의 player/caption/comment 요청은 이 프록시를 사용합니다.

### write-media

HTTPS `googlevideo.com` 계열 미디어 URL만 허용합니다. 실제 URL은 저장 동작 중에만 호스트로 전달합니다.

### 파일 action

```text
pick-file
pick-dir
dir-file
write-text
write-media
```

실제 `FileSystemFileHandle`과 `FileSystemDirectoryHandle`은 YouTube 상위 페이지 메모리에만 둡니다. UI에는 임시 handle ID만 반환합니다.

## 6. ui.html 내부 호환 객체

Transport가 넣는 shim은 기존 UI 코어가 계속 같은 인터페이스를 사용하도록 가상 parent를 제공합니다.

```text
parent.document
parent.location
parent.fetch
parent.ytcfg.get()
parent.__YTDL_CALL()
parent.__YTDL_WEBAPP_URL
parent.__YTDL_TOKEN
parent.__YTDL_CLOSE()
```

따라서 YouTube 추출·Sheets·UI 기능 코드는 `ui.html`에 유지하고 고정 로더에는 넣지 않습니다.

## 7. 사용자 저장 입력

```js
{
  types:['video','audio','data'],
  target:'local'|'drive',
  video:{id},
  audio:{id},
  data:{fields:[],format:'original'|'txt'|'json',comments:{count,sort}},
  drive:{fileId,sheetName,category},
  management:{category,tags,purpose,priority,status,memo,aiSend},
  clearManagement:['tags','purpose','priority','status','memo','aiSend','category'],
  duplicateMode:'update'|'new',
  targetRow:2
}
```

중복 업데이트에서는 이번 실행에서 사용자가 직접 바꾼 관리정보만 `management`에 넣습니다. 사용자가 직접 비운 항목만 `clearManagement`에 넣고, 건드리지 않은 항목은 전달하지 않아 기존값을 보존합니다.

## 8. Sheets 저장

```text
데이터 + Drive
→ ui.html collect()
→ host gas
→ 숨은 POST bridge
→ save-record
→ Code.gs
→ SpreadsheetApp
```

중복이면 UI 내부 `dup` 상태를 갱신하고 업데이트/새 기록 선택 영역을 표시합니다.

## 9. 로컬 저장

사용자가 UI에서 저장을 누르면 UI의 파일 선택 프록시가 상위 YouTube 페이지에서 File System Access API를 실행합니다.

```text
한 종류
→ pick-file

복수 종류
→ pick-dir
→ dir-file
```

그 뒤 텍스트는 `write-text`, 영상/음성은 `write-media`로 기록합니다.

## 10. Drive 미디어

Google Save to Drive 버튼만 렌더링된 시점은 저장 완료가 아닙니다.

UI는 다음 상태를 구분합니다.

```text
데이터 저장 완료
Drive 버튼 준비됨
일부 데이터 미수집
저장 실패
```

## 11. 보안 검증

- YouTube origin은 Code.gs 허용 목록과 일치해야 함
- Apps Script 클라이언트 origin은 HTTPS `script.google.com` 또는 `*-script.googleusercontent.com` 계열만 허용
- 모든 메시지는 실행 token 확인
- 최초 UI 준비 메시지 이후 sender window와 origin을 현재 UI 채널로 고정
- 임의 외부 fetch 금지
- 임의 외부 미디어 URL 기록 금지

## 12. 종료

```text
닫기
→ 화면 UI iframe 제거
→ 숨은 bridge iframe 제거
→ message listener 제거
→ 파일/폴더 handle Map 폐기
→ 늦은 응답 무시
```

미디어 URL, 파일 핸들, 인증정보를 영구 저장하지 않습니다.