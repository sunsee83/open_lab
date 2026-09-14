# 유튜브다운로드 실행 코어 규격

## 1. 코드 배치

```text
bookmarklet.js
→ 5,000자 이하 고정 로더
→ 별도 Google 연결 탭 생성
→ ui.html Blob iframe 표시

ui.html
→ 실제 YouTube 추출/저장/UI 코어

Transport.gs
→ top-level Apps Script 브리지
→ google.script.run RPC

Code.gs
→ Google Sheets 처리
```

YouTube 추출 규칙과 사용자 기능을 `bookmarklet.js`에 누적하지 않습니다.

## 2. bookmarklet.js 책임

```text
공용 Apps Script /exec 주소 보유
실행 token 생성
별도 Google 연결 탭 즉시 생성
mode=bridge POST
Google READY sender window + origin 고정
ui.html Blob URL 생성/표시
parent.__YTDL_CALL 제공
종료 시 UI/Blob/연결 탭 정리
```

승인을 확인하기 위한 숨은 iframe이나 15초 승인 대기 팝업은 사용하지 않습니다. 현재 YouTube 탭을 승인 페이지로 이동시키지도 않습니다.

## 3. Transport.gs 책임

```text
mode=bridge 처리
Google 승인 세션의 top-level 연결 페이지 생성
window.top.opener로 YouTube 창 연결
google.script.run.bridgeTopDispatch()
create-storage
Code.gs dispatch 전달
```

Apps Script HTML Service 내부 sandbox window가 실제 `postMessage` sender가 될 수 있으므로 YouTube는 최초 `YTDL_BRIDGE_READY`를 보낸 `event.source`와 Google origin을 이후 채널로 고정합니다.

## 4. ui.html 책임

```text
일반 영상/Shorts ID 확인
youtubei/player 호출
영상/음성 후보 생성
데이터 선택/추출/출력
파일 → 시트 → 카테고리
관리정보
중복 처리
로컬 저장
Drive 저장
```

UI 원본은 Google 연결 탭에서 전달받지만 실제 UI는 YouTube 문서가 만든 Blob iframe에서 실행됩니다. 따라서 기존 `parent.document`, `parent.location`, `parent.fetch`, `parent.ytcfg`, `parent.__YTDL_CALL` 인터페이스를 유지합니다.

`iframe.srcdoc`은 사용하지 않습니다.

## 5. Apps Script 요청

```text
ui.html
→ parent.__YTDL_CALL(action,payload)
→ YTDL_BRIDGE_REQUEST
→ 인증된 Google 연결 탭
→ google.script.run.bridgeTopDispatch
→ bridgeDispatch_
→ Code.gs dispatch
→ YTDL_BRIDGE_RESPONSE
```

OAuth access/refresh token은 YouTube나 GitHub에 전달하지 않습니다.

## 6. YouTube player

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

- 영상: `streamingData.formats`의 direct `video/mp4`
- 음성: `adaptiveFormats`의 direct `audio/mp4`
- 실제 URL은 현재 실행 메모리에만 보관

## 7. Google 저장공간

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

## 8. 데이터 저장

```text
데이터 + Drive
→ ui.html collect
→ __YTDL_CALL('save-record')
→ Google 연결 탭
→ Apps Script
→ SpreadsheetApp
```

이번 실행에서 실제로 얻은 필드만 `record`에 포함하며, 중복 업데이트에서는 이번 실행에서 실제 변경한 관리정보만 갱신합니다.

## 9. 로컬 저장과 user activation

Blob UI에서 사용자가 `[저장]`을 누른 클릭을 기준으로 picker 호출을 상위 YouTube window에 동기 위임합니다.

```text
showSaveFilePicker / showDirectoryPicker
→ parent의 동일 API 즉시 호출
→ 실제 FileSystemHandle 확보
→ ui.html saveLocal 계속 실행
```

파일 선택 전에 장시간 데이터 수집이나 비동기 Apps Script 호출을 넣지 않습니다.

미디어 기록은 검증된 GoogleVideo direct URL과 `Range: bytes=0-` 경로를 사용합니다.

## 10. 영상/음성 Drive

```text
ui.html
→ Google Save to Drive 버튼 준비
→ 사용자가 공식 Google 버튼 클릭
→ My Drive 저장
```

버튼 렌더링은 저장 완료가 아닙니다.

## 11. 고정 로더 원칙

향후 UI, 추출 필드, 댓글/자막, Sheets 규칙, Drive 표시 변경은 `ui.html`, `Transport.gs`, `Code.gs`에서 처리합니다.

Android Whale 배포용 `bookmarklet.js`는 **5,000자 이내를 절대 상한**으로 유지합니다.

## 12. 영구 저장 금지

```text
미디어 direct URL
실제 FileSystemHandle
인증 쿠키
Google OAuth access/refresh token
YouTube 로그인 정보
실행 token
```

이 값들은 실행 종료 시 폐기합니다.
