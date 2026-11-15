# 영어단어 조사 도구

2022 개정 영어과 기본 어휘를 출처별로 검증하기 위한 **재사용 가능한 조사 코드**입니다. 조사 결과물은 현재 저장하지 않았습니다.

## 구성

- `words-elementary-pilot.json`: 교육부 원본 첫 10개 표제어군의 입력 목록. 조사 결과가 아님.
- `scripts/collect.mjs`: NAVER Oxford 화면의 의미·예문·품사·발음 및 표시 영역 추출 시도.
- `scripts/parse-logic.mjs`: 추출 데이터 정규화 및 조사 범위 집계.
- `tests/parse-logic.test.mjs`: 파서 검증.
- `.github/workflows/vocabulary-research.yml`: **수동 실행 전용** GitHub Actions.

## 실행

`npm install` → `npm run check` → `npm run collect`.

GitHub에서 직접 시험할 때는 `Actions` → `Elementary Vocabulary Research (10)` → `Run workflow`를 사용합니다. 코드 복구만으로는 실행하지 않습니다.

## 현재 상태

기존 GitHub Actions Ubuntu 실행기에서는 네이버 페이지 접속 타임아웃으로 실제 자료 수집에 실패했습니다. **재시도할 코드와 입력은 보존했으며, 검증된 단어 조사 데이터가 있다는 뜻은 아닙니다.**

연습용 보고서·AI가 만든 뜻 풀이·예문 결과는 공개 저장소의 현재 브랜치에서 제거했습니다. 사용자 승인과 검증 기준 없이 학습 앱의 기존 데이터에 반영하지 않습니다.
