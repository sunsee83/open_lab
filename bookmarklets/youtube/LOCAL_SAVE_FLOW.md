# YouTube 영상·음성 로컬 저장

이 문서는 통합 UI의 `영상 / 음성` 선택을 Android 모바일 로컬 저장 경로에 연결하는 현재 규격입니다.

YouTube 스트림 추출과 후보 선택 로직은 `ui.html`에 유지합니다. 실제 File System Access API와 GoogleVideo 파일 쓰기는 상위 YouTube 페이지의 고정 호스트 로더가 수행합니다.

## 1. 후보 생성

```text
ui.html player()
→ streamingData 분석
→ 영상/음성 후보 Map 생성
→ UI에는 품질 + 임시 후보 ID 표시
```

실제 미디어 URL은 현재 UI 실행 메모리에만 둡니다.

## 2. UI 선택과 저장 계획

사용자는 `영상`, `음성`, 또는 둘 다 선택할 수 있습니다.

```text
영상 선택 → 화질
음성 선택 → 음질
저장 위치 → 로컬
```

선택 상태가 바뀔 때 `ui.html`은 상위 페이지에 `YTDL_SAVE_PLAN`을 보냅니다.

```text
저장 대상 종류
파일명
picker 옵션
busy / configured 상태
```

실제 미디어 URL이나 FileSystemHandle은 저장 계획에 넣지 않습니다.

## 3. 사용자 활성화 보존

Apps Script UI는 cross-origin iframe이므로 iframe 안의 클릭을 `postMessage`로 부모에 넘긴 뒤 `showSaveFilePicker()`를 호출하는 방식은 사용하지 않습니다.

화면 하단의 실제 `저장 / 닫기` 버튼은 YouTube 상위 문서가 만듭니다. 사용자가 이 `저장` 버튼을 직접 누른 동일한 click handler 안에서 파일/폴더 선택창을 즉시 엽니다.

```text
사용자 [저장]
→ 상위 YouTube 문서 click handler
→ showSaveFilePicker() 또는 showDirectoryPicker() 즉시 호출
→ 실제 handle 확보
→ 그 다음에만 YTDL_HOST_SAVE 전송
```

이 순서로 cross-origin `postMessage` 때문에 user activation이 소실되는 문제를 피합니다.

## 4. 단일 파일 저장

```text
사용자 [저장]
→ 상위 페이지 showSaveFilePicker()
→ 실제 FileSystemFileHandle은 호스트 Map에 보관
→ 임시 fileId 발급
→ YTDL_HOST_SAVE {local:{fileId}}
→ ui.html 기존 saveLocal() 실행
→ shim의 showSaveFilePicker() 호환 함수가 임시 handle을 반환
```

영상/음성 기록:

```text
선택 미디어 URL
→ write-media
→ URL이 googlevideo.com 계열인지 확인
→ YouTube 페이지 fetch
→ Range: bytes=0-
→ response.body.pipeTo(await handle.createWritable())
```

## 5. 복수 파일 저장

영상, 음성, 데이터를 둘 이상 함께 로컬 저장하면 폴더 선택을 사용합니다.

```text
사용자 [저장]
→ 상위 페이지 showDirectoryPicker()
→ 실제 DirectoryHandle은 호스트 Map에 보관
→ 임시 dirId 발급
→ YTDL_HOST_SAVE {local:{dirId}}
→ ui.html 기존 saveLocal() 실행
→ 항목별 dir-file
→ 임시 FileHandle ID 반환
→ write-media / write-text
```

## 6. 영상 저장

```text
영상 제목 기반 .mp4 파일명 생성
→ 금지 문자 정리
→ 파일/폴더 선택
→ 선택한 progressive MP4 URL 기록
```

검증된 범위:

- Android Whale
- 일반 영상
- Shorts
- 영상+음성 통합 MP4
- 현재 직접 저장 검증 화질 360p

고화질 분리 스트림 mux는 이 경로에 포함하지 않습니다.

## 7. 음성 저장

```text
영상 제목 기반 .m4a 파일명 생성
→ 파일/폴더 선택
→ 선택 audio/mp4 URL 기록
```

현재 검증 경로는 `audio/mp4` 계열입니다.

## 8. 데이터와 함께 저장

`영상 + 음성 + 데이터`처럼 복수 선택한 경우에도 파일 선택은 데이터 수집보다 먼저 끝냅니다.

```text
상위 [저장]
→ 폴더 handle 확보
→ UI 저장 실행
→ 영상/음성 write-media
→ 데이터 collect
→ write-text
```

데이터 수집 시간이 길어도 이미 확보한 DirectoryHandle을 사용하므로 user activation을 다시 요구하지 않습니다.

## 9. 상태 처리

각 항목은 독립적으로 결과를 기록합니다.

```text
저장 완료
저장 취소
저장 실패
```

한 항목의 실패가 다른 항목의 성공 결과를 취소하지 않습니다.

## 10. 저장 경계

실행 중 영구 저장하지 않는 값:

```text
실제 미디어 URL
실제 FileSystemFileHandle
실제 FileSystemDirectoryHandle
계정/세션 정보
인증 쿠키
OAuth token
```

실제 파일/폴더 핸들은 호스트 Map에만 존재하고 실행 종료 시 폐기합니다.

YouTube 추출 규칙은 `CORE_SPEC.md`, 메시지 형식은 `PROTOCOL.md`를 따릅니다.
