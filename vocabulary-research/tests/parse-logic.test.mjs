import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReportEntry, summarize } from '../scripts/parse-logic.mjs';

test('품사별 뜻을 모두 세고 누락된 수준은 미분류로 표시한다', () => {
  const result = normalizeReportEntry(
    { entryId: 'elementary-010', headword: 'after', rawEntry: 'after*', relatedOriginalForms: [] },
    { status: 'extracted', source: 'https://en.dict.naver.com/', pronunciation: {},
      senses: [
        { partOfSpeech: 'Preposition', level: 'Beginner', examples: [{english: 'x'}] },
        { partOfSpeech: 'Preposition', level: null, examples: [] },
        { partOfSpeech: 'Adverb', level: 'Intermediate', examples: [{english: 'y'}] }
      ], idioms: [1, 2], thesaurus: [1], extractionLimits: [] }, 2000
  );
  assert.equal(result.sensesTotal, 3);
  assert.deepEqual(result.byPartOfSpeech, { Preposition: 2, Adverb: 1 });
  assert.deepEqual(result.byLevel, { Beginner: 1, unclassified: 1, Intermediate: 1 });
  assert.equal(result.examplePairsFound, 2);
  assert.equal(result.idiomCount, 2);
});

test('실패한 단어는 완료로 계산하지 않는다', () => {
  const report = summarize([{ status: 'extracted', sensesTotal: 4, examplePairsFound: 3 }, { status: 'failed' }], '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z');
  assert.equal(report.requested, 2);
  assert.equal(report.extracted, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.meanPerRequestedMs, 5000);
});
