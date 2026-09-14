# Google 저장공간 연결 구조

## 1. 이름 체계

```text
북마클릿      유튜브다운로드
Apps Script  유튜브다운로드앱_v1
기본 Sheets  유튜브다운로드sheet_v1
```

## 2. 독립형 Apps Script

Google Sheets에 바인딩하지 않습니다.

```text
유튜브다운로드앱_v1
├─ Code.gs
├─ Transport.gs
└─ ui.html
```

웹 앱 실행 사용자는 `웹 앱에 액세스하는 사용자`, 액세스 대상은 `Google 계정이 있는 모든 사용자`입니다.

## 3. 최초 사용자

```text
유튜브다운로드 실행
→ 별도 Google 연결 탭 즉시 생성
→ mode=bridge POST
→ Google 미승인 상태면 연결 탭에서 승인
→ 승인 완료 안내
→ 승인 탭 닫기
→ 기존 YouTube 탭에서 유튜브다운로드 다시 실행
→ 연결 탭이 인증된 bridge 페이지로 열림
→ UI 표시
→ create-storage
→ SpreadsheetApp.create('유튜브다운로드sheet_v1')
→ 수집 시트 구성
→ 안내 시트 구성
→ 기본 카테고리 등록
→ 사용자별 UserProperties에 파일 ID/이름 저장
```

현재 YouTube 탭을 승인 페이지로 이동시키지 않으며, 승인 여부를 확인하려고 숨은 iframe을 15초 기다리지 않습니다.

사용자는 최초 설정에서 Sheets를 직접 만들거나 주소를 입력하지 않습니다.

## 4. 이후 실행

```text
유튜브다운로드 실행
→ 별도 Google 연결 탭 즉시 생성
→ mode=bridge POST
→ 인증된 Apps Script bridge 준비
→ ui.html을 YouTube에 전달
→ Blob iframe UI 표시
→ create-storage
→ 기존 연결 재사용
→ get-state
→ defaultFileId
→ SpreadsheetApp.openById(...)
→ 파일 → 시트 → 카테고리 복원
```

연결 탭은 UI가 실행되는 동안 `google.script.run` RPC를 처리하므로 열어 둡니다. 도구를 닫으면 연결 탭도 닫기를 시도합니다.

같은 웹 앱을 여러 사용자가 사용해도 `UserProperties`와 데이터 파일은 사용자별로 분리됩니다.

`UserProperties`에는 연결 파일 같은 최소 사용자 상태만 유지합니다. 카테고리 목록은 해당 Sheets의 `안내` 탭 숨김 관리영역에 저장합니다.

## 5. 기존 Sheets 추가

자동 생성 기본 파일 외에 이미 가진 Sheets를 추가할 때만:

```text
기존 Sheets URL 입력
→ connect-file
→ 접근 권한 확인
→ 연결 목록에 추가
```

연결 파일 최대 10개입니다.

## 6. 기본 파일 구조

```text
유튜브다운로드sheet_v1
├─ 안내
│  ├─ A열: 사용자 안내
│  └─ C:D 숨김 관리영역: 시트별 카테고리
└─ 수집
   └─ 기본 카테고리
```

- 데이터 시트 최대 10개
- 시트당 기록 최대 2,000개
- 1,800개부터 한도 경고
- 기록 수와 다음 저장 행은 `영상 ID` 열 기준

## 7. ui.html의 위치와 표시

`ui.html`은 Google Sheets 안의 데이터가 아니라 Apps Script 프로그램 파일입니다.

```text
Transport.gs
→ ui.html 원본 읽기
→ 인증된 Google 연결 탭
→ YTDL_BRIDGE_READY로 YouTube에 전달
→ bookmarklet.js가 Blob URL 생성
→ 전체화면 iframe 표시
```

`iframe.srcdoc`은 사용하지 않습니다. Blob UI는 YouTube 문맥에서 실행되며 Google 작업만 별도 인증 탭의 `google.script.run`을 통해 처리합니다.

따라서 `유튜브다운로드sheet_v1`에는 코드나 UI 파일을 넣지 않습니다.
