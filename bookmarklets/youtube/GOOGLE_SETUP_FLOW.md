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
→ 숨은 bridge init 시도
→ Google 미승인 상태면 승인 페이지 이동 확인
→ Google 승인
→ YouTube로 돌아감
→ 유튜브다운로드 다시 실행
→ 화면용 Apps Script UI 표시
→ get-state
→ 연결 파일 없음
→ create-storage
→ SpreadsheetApp.create('유튜브다운로드sheet_v1')
→ 수집 시트 구성
→ 안내 시트 구성
→ 기본 카테고리 등록
→ 사용자별 UserProperties에 파일 ID/이름 저장
```

사용자는 최초 설정에서 Sheets를 직접 만들거나 주소를 입력하지 않습니다.

승인 페이지의 `doGet()`은 승인 완료 안내만 표시합니다. 실제 UI와 데이터 요청은 YouTube에서 실행한 POST 브리지를 사용합니다.

## 4. 이후 실행

```text
bridge init
→ mode=ui POST
→ ui.html 표시
→ create-storage
→ 기존 연결 있으면 재사용
→ get-state
→ defaultFileId
→ SpreadsheetApp.openById(...)
→ 파일 → 시트 → 카테고리 복원
```

같은 웹 앱을 여러 사용자가 사용해도 `UserProperties`와 데이터 파일은 사용자별로 분리됩니다.

`UserProperties`에는 연결 파일 같은 최소 사용자 상태만 유지합니다. 새 카테고리 목록은 해당 Sheets의 `안내` 탭 숨김 관리영역에 저장합니다.

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

`ui.html`은 Google Sheets 안에 들어가는 데이터가 아니라 Apps Script 프로그램 파일입니다.

```text
bookmarklet.js
→ 화면용 iframe 생성
→ /exec에 mode=ui POST
→ Transport.gs
→ HtmlService로 ui.html 표시
→ host bridge 연결
```

YouTube 문서 안에서 `srcdoc`이나 Blob URL로 UI HTML을 생성하지 않습니다.

Apps Script UI의 실제 실행 origin은 `*-script.googleusercontent.com` 계열일 수 있으므로 로더는 해당 Apps Script origin과 실행 token을 함께 검증합니다.

따라서 `유튜브다운로드sheet_v1`에는 코드나 UI 파일을 넣지 않습니다.