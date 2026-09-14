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

## 2. UI 선택

사용자는 `영상`, `음성`, 또는 둘 다 선택할 수 있습니다.

```text
영상 선택 → 화질
음성 선택 → 음질
저장 위치 → 로컬
```

## 3. 단일 파일 저장

```text
사용자 [저장]
→ ui.html의 showSaveFilePicker 호환 함수
→ YTDL_HOST_REQUEST / pick-file
→ 상위 YouTube 페이지에서 실제 showSaveFilePicker()
→ 실제 FileSystemFileHandle은 호스트 Map에 보관
→ UI에는 임시 handle ID만 반환
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

## 4. 복수 파일 저장

영상, 음성, 데이터를 둘 이상 함께 로컬 저장하면 폴더 선택을 사용합니다.

```text
pick-dir
→ 상위 페이지 showDirectoryPicker()
→ 실제 DirectoryHandle은 호스트 Map에 보관
→ 항목별 dir-file
→ 임시 FileHandle ID 반환
→ write-media / write-text
```

## 5. 영상 저장

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

## 6. 음성 저장

```text
영상 제목 기반 .m4a 파일명 생성
→ 파일/폴더 선택
→ 선택 audio/mp4 URL 기록
```

현재 검증 경로는 `audio/mp4` 계열입니다.

## 7. 사용자 활성화

Apps Script UI는 cross-origin iframe이지만 사용자가 UI 안의 `[저장]`을 직접 누른 동작을 기준으로 즉시 host file action을 요청합니다. 파일 선택 동작 사이에 데이터 수집 같은 장시간 작업을 먼저 넣지 않습니다.

## 8. 상태 처리

각 항목은 독립적으로 결과를 기록합니다.

```text
저장 완료
저장 취소
저장 실패
```

한 항목의 실패가 다른 항목의 성공 결과를 취소하지 않습니다.

## 9. 저장 경계

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