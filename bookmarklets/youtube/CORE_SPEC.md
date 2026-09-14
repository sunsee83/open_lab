# 유튜브다운로드 실행 코어 규격

## 1. 코드 배치

```text
bookmarklet.js
→ 고정 호스트 로더

ui.html
→ 실제 YouTube 추출/저장/UI 코어

Transport.gs
→ Apps Script POST 브리지 + UI HTML 응답

Code.gs
→ Google Sheets 처리
```

YouTube 추출 규칙과 사용자 기능을 `bookmarklet.js`에 누적하지 않습니다.

## 2. bookmarklet.js 책임

```text
공용 Apps Script /exec 주소 보유
실행 token 생성
숨은 bridge iframe + form POST
bridgeNonce 발급/재연결
화면용 iframe 생성
mode=ui POST
Apps Script UI와 YouTube 상위 페이지 연결
허용된 YouTube fetch 프록시
로컬 파일 선택/쓰기 프록시
종료 시 iframe/listener/handle 정리
```

북마클릿은 화면 HTML을 만들지 않습니다. `iframe.srcdoc`과 Blob URL도 사용하지 않습니다.

## 3. ui.html 책임

```text
일반 영상/Shorts ID 확인
youtubei/player 호출 로직
영상/음성 후보 생성
전체 사용자 화면
데이터 선택/추출/출력
파일 → 시트 → 카테고리 선택
관리정보
중복 처리
Apps Script action 호출
로컬 저장 흐름
Drive 저장 영역
```

`ui.html`은 Apps Script HTML Service iframe에서 실행됩니다. YouTube 페이지에 직접 접근할 수 없으므로 Transport가 넣는 host shim을 통해 필요한 기능만 상위 YouTube 페이지에 요청합니다.

## 4. 호스트 프록시

ui.html이 사용하는 기존 인터페이스는 가상 parent 객체로 유지합니다.

```text
parent.document       현재 영상 메타데이터 보기
parent.location       현재 YouTube URL
parent.fetch          허용된 YouTube 요청 프록시
parent.ytcfg.get      youtubei context/key 보기
parent.__YTDL_CALL    Apps Script action
parent.__YTDL_CLOSE   실행 종료
```

실제 YouTube DOM 전체나 쿠키 객체를 UI에 전달하지 않습니다.

## 5. YouTube player

UI 코어의 호출 규격:

```js
fetch('https://www.youtube.com/youtubei/v1/player',{
  method:'POST',
  credentials:'omit',
  headers:{
    'content-type':'application/json',
    'x-youtube-client-name':'3',
    'x-youtube-client-version':'20.10.38'
  },
  body:JSON.stringify({
    videoId,
    context:{client:{
      clientName:'ANDROID',
      clientVersion:'20.10.38',
      androidSdkVersion:30,
      hl:'ko',
      gl:'KR'
    }}
  })
})
```

실제 네트워크 요청은 host fetch 프록시가 YouTube 페이지에서 수행합니다.

- 영상: `streamingData.formats`의 direct `video/mp4`
- 음성: `adaptiveFormats`의 direct `audio/mp4`
- 실제 URL은 현재 실행 메모리의 후보 Map에만 보관
- UI select에는 후보 ID와 품질만 표시

## 6. Google 저장공간

```text
ui.html 시작
→ create-storage
→ 기존 연결 있으면 재사용
→ 없으면 유튜브다운로드sheet_v1 생성
→ 수집 시트 + 기본 카테고리
→ get-state / list-sheets / list-categories
```

기본값:

```text
파일      유튜브다운로드sheet_v1
시트      수집
카테고리  기본
```

## 7. 데이터 저장

```text
데이터 + Drive
→ ui.html collect
→ host gas
→ POST bridge
→ save-record
→ SpreadsheetApp
```

이번 실행에서 실제로 얻은 필드만 `record`에 포함합니다.

중복 업데이트에서는 사용자가 이번 실행에서 실제 변경한 관리정보만 갱신합니다.

## 8. 로컬 저장

File System Access API는 상위 YouTube 페이지의 호스트 로더가 실행합니다.

```text
UI 저장 클릭
→ pick-file 또는 pick-dir
→ 상위 페이지가 실제 FileSystemHandle 확보
→ UI에는 임시 handle ID 반환
→ write-text 또는 write-media
```

실제 파일/폴더 핸들은 상위 페이지 실행 메모리에만 유지합니다.

미디어 기록은 검증된 GoogleVideo URL만 허용하고 `Range: bytes=0-` 요청을 사용합니다.

## 9. 영상/음성 Drive

```text
미디어 direct URL
→ ui.html 실행 메모리
→ Google Save to Drive 버튼
→ 사용자가 공식 버튼을 눌러 My Drive 저장
```

Sheets 데이터 저장 경로와 별도입니다.

## 10. 고정 로더 원칙

향후 UI, 추출 필드, 댓글/자막 처리, Sheets 규칙, Drive 표시 변경은 Apps Script 파일 쪽에서 처리합니다.

고정 로더를 바꿔야 하는 범위는 상위 페이지에서만 가능한 브라우저 권한/통신 프로토콜 자체가 바뀌는 경우로 제한합니다.

## 11. 영구 저장 금지

```text
미디어 direct URL
실제 FileSystemHandle
인증 쿠키
Google OAuth access/refresh token
YouTube 로그인 정보
bridge nonce/token
```

이 값들은 실행 종료 시 폐기합니다.