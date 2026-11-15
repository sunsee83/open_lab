import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const base = new URL('../', import.meta.url);
const input = new URL('data/elementary-first-10-study.json', base);
const output = new URL('reports/elementary-first-10-study.md', base);
const data = JSON.parse(readFileSync(input, 'utf8'));

const sections = [
  '# 영어단어 첫 10개 — 실제 뜻·문법·학습 예문',
  '',
  `작성 기준: ${data.createdAtKst} · 교육부 원본 10개 단어군 · Oxford 상세 표제어 12개`,
  '',
  '> 아래 뜻 설명과 영어 예문은 사전 원문을 복제한 것이 아니라, 확인한 의미 구분에 맞추어 새로 작성한 학습 자료입니다. 사전의 개별 용례와 완전히 같다고 주장하지 않습니다. 확인하지 않은 어원·시험 출제 빈도는 조사 완료로 처리하지 않았습니다.',
  '',
  '## 조사 범위',
  '',
  '- 본단어 10개, 세부 의미 88개; 괄호 관련형 `actual`, `interact` 2개, 추가 의미 4개',
  '- 뜻별 새 영어 예문·한국어 번역, 발음, 품사, 기본 활용형, 핵심 구문, 시험 주의점',
  '- 뜻 출처는 각 단어 제목 옆의 네이버 영어사전 Oxford 상세 링크에서 확인 가능합니다.',
  '- 숙어·유의어 전수 조사, 어원, 실제 기출 빈도 등 남은 항목은 단어별 확인 대기 목록에 별도로 표시합니다.',
  ''
];

function list(label, items, bullet = '-') {
  if (!items?.length) return;
  sections.push(`**${label}**`, '');
  for (const item of items) {
    if (typeof item === 'string') sections.push(`${bullet} ${item}`);
    else sections.push(`${bullet} ${item.phrase}: ${item.studyMeaning}`);
  }
  sections.push('');
}

for (const [i, entry] of data.entries.entries()) {
  const count = entry.senses.reduce((n, group) => n + group.items.length, 0);
  sections.push(`## ${i + 1}. ${entry.originalListGroup} — ${count}개 의미`, '',
    `- 출처: [Oxford 상세 화면](${entry.dictionarySource})`,
    `- 발음: 미국 ${entry.pronunciation.us} · 영국 ${entry.pronunciation.gb}${entry.pronunciation.an ? ` · an ${entry.pronunciation.an}` : ''}`,
    `- 형태: ${entry.forms.join(' / ')}`, '');

  for (const group of entry.senses) {
    sections.push(`### ${group.part}`, '');
    for (const [j, [ko, example, translation]] of group.items.entries()) {
      sections.push(`${j + 1}. **${ko}**`, `   - ${example}`, `   - ${translation}`);
    }
    sections.push('');
  }
  list('문법·구문', entry.grammarPatterns);
  list('자주 결합하는 표현', entry.collocations);
  list('숙어', entry.idioms);
  list('관련형·형태', entry.wordFamilyNotes);
  list('뜻의 차이', entry.meaningContrast);
  list('시험·암기 주의점', entry.examNotes);

  for (const word of entry.relatedHeadwords || []) {
    sections.push(`### 관련 원본 단어: ${word.headword}`, '',
      `- 출처: [Oxford 상세 화면](${word.source})`,
      `- 발음: ${word.pronunciation} / 품사: ${word.part}`,
      ...(word.forms ? [`- 형태: ${word.forms.join(' / ')}`] : []), '');
    word.senses.forEach(([ko, en, translation], j) => sections.push(`${j + 1}. **${ko}**`, `   - ${en}`, `   - ${translation}`));
    sections.push('');
    list('문법·구문', word.grammarPatterns);
    list('시험·암기 주의점', word.examNotes);
  }
  list('추가 검증 필요', entry.furtherChecks);
}

sections.push('## 확인 상태', '',
  '- 네이버 Oxford 상세 화면에서 확인한 사항: 12개 표제어, 본단어 88개 및 관련형 4개의 개별 의미 구분, 대표 발음·품사와 일부 구문.',
  '- 별도로 작성한 내용: 위 의미 풀이, 예문, 번역, 패턴 설명, 시험 주의점. 이는 실전 문제로 확정 검증한 자료가 아닙니다.',
  '- 미완료: 독립 교차검증이 필요한 어원·접사 분석, 의미별 유의어·반의어 전수 비교, 학교·수능 실제 기출 검증.',
  '');

writeFileSync(output, sections.join('\n') + '\n', 'utf8');
console.log(`Rendered ${data.entries.length} groups, ${data.entries.reduce((n, e) => n + e.senses.reduce((m, g) => m + g.items.length, 0), 0)} senses: ${fileURLToPath(output)}`);
