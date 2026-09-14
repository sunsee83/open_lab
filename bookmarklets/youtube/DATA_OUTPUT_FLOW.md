# YouTube 데이터 출력 / 로컬 저장

이 문서는 `ui.html`이 수집한 데이터를 `원문 / TXT / JSON`으로 변환하고 Android 로컬 파일로 저장하는 현재 규격입니다.

YouTube 전용 추출 세부 규칙은 `DATA_EXTRACT_FLOW.md`를 따릅니다.

## 1. 역할 분리

### `ui.html`

- 사용자가 선택한 필드만 수집
- 성공값과 필드별 오류를 하나의 결과 packet으로 유지
- 원문/TXT/JSON 문자열 생성
- 파일명 생성
- 현재 로컬 저장 계획을 host에 미리 전달
- host가 확보한 임시 handle ID를 사용해 기존 저장 흐름 실행

### `bookmarklet.js` 호스트

- 상위 YouTube 문서의 실제 `저장 / 닫기` 버튼 표시
- 실제 사용자 클릭에서 `showSaveFilePicker()` / `showDirectoryPicker()` 즉시 실행
- 실제 File System handle 보관
- 임시 handle ID 발급
- `write-text` / `write-media` 실행

로컬 원문/TXT/JSON은 Sheets의 셀당 약 49,000자 제한과 무관하게 수집 결과 전체를 기록합니다. Sheets 저장에서만 초과 문자열을 자르고 `[일부 내용 생략]` 표시를 붙입니다.

## 2. 공통 결과

```js
{
  videoId:'',
  requested:[],
  result:{},
  errors:{},
  complete:true
}
```

특정 필드가 실패해도 성공한 다른 필드는 `result`에 유지합니다.

## 3. 원문

사람과 AI가 바로 읽기 좋은 정리형 텍스트입니다.

- 기본정보는 읽기 쉬운 항목명으로 표시
- 설명/대본은 별도 구역
- 태그/댓글/원본 데이터 구분
- 일부 필드 실패 시 오류 항목 함께 표시
- 확장자 `.txt`

## 4. TXT

가공을 최소화한 평문 출력입니다.

- 기본 필드: `항목명: 값`
- 배열/객체는 평문으로 변환
- 대본은 전체 텍스트 중심
- 오류 필드는 `오류(항목명)`으로 표시
- 확장자 `.txt`

## 5. JSON

```js
{
  videoId:'',
  requested:[],
  result:{},
  errors:{}
}
```

- UTF-8
- 2칸 들여쓰기
- 확장자 `.json`

## 6. 로컬 저장 순서

파일/폴더 선택은 데이터 수집보다 먼저 실행하며, 브라우저 picker는 iframe 안에서 호출하지 않습니다.

```text
UI 선택 상태
→ YTDL_SAVE_PLAN으로 파일명/picker 옵션을 host에 미리 동기화
→ 사용자 상위 [저장] 버튼 직접 클릭
→ 단일: showSaveFilePicker() 즉시 호출
→ 복수: showDirectoryPicker() 즉시 호출
→ 상위 YouTube 페이지에서 실제 File System handle 확보
→ 임시 handle ID 발급
→ YTDL_HOST_SAVE
→ UI의 기존 saveLocal() 실행
→ 선택 데이터 collect()
→ formatData()
→ write-text
→ 실제 파일 기록
```

실제 파일 핸들은 `postMessage`로 전달하지 않습니다. 메시지에는 임시 handle ID만 포함합니다.

이 순서에서 파일 선택창은 실제 사용자 click handler 안에서 먼저 열리므로 cross-origin iframe의 `postMessage` 때문에 user activation이 끊기지 않습니다.

## 7. 파일명

영상 제목을 기준으로 파일명 금지 문자를 정리합니다.

```text
원문 → 영상 제목_원문.txt
TXT  → 영상 제목_데이터.txt
JSON → 영상 제목_데이터.json
```

영상 제목을 사용할 수 없으면 `유튜브다운로드`를 기본 이름으로 사용합니다.

## 8. 복수 선택

`영상 + 음성 + 데이터` 동시 선택을 허용합니다.

- 상위 페이지에서 DirectoryHandle을 먼저 확보
- 영상/음성: `write-media`
- 데이터: `write-text`
- 한 항목 실패가 다른 항목의 완료 결과를 취소하지 않음

## 9. 취소 / 오류

- 파일/폴더 선택 취소 → `YTDL_HOST_SAVE`를 보내지 않고 로컬 저장 시작하지 않음
- 데이터 일부 실패 → 확보된 결과 저장 + 오류 항목 포함
- 파일 쓰기 실패 → 해당 파일만 실패
- 데이터 실패 → 영상/음성 저장 결과에 영향 없음

## 10. 실행 메모리

UI 실행 중 보관할 수 있는 값:

```text
현재 데이터 packet
현재 선택 출력 형식
미디어 후보 Map
임시 handle ID
```

상위 호스트 실행 중에만 보관하는 값:

```text
실제 FileSystemFileHandle
실제 FileSystemDirectoryHandle
```

실행 종료 시 모두 폐기합니다.
