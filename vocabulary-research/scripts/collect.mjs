import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalizeReportEntry, summarize } from './parse-logic.mjs';

const input = JSON.parse(readFileSync(new URL('../words-elementary-pilot.json', import.meta.url), 'utf8'));
if (input.group !== 'elementary' || input.entries.length !== 10 || new Set(input.entries.map(x => x.entryId)).size !== 10) {
  throw new Error('Pilot input must contain ten unique official elementary groups.');
}

const startedAt = new Date().toISOString();
const raw = [];
const reportEntries = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1365, height: 1024 } });
const page = await context.newPage();
page.setDefaultTimeout(12000);

/** Extract only DOM content rendered by the Naver Oxford entry view. No internal endpoints or unrelated sites. */
async function extractVisibleEntry() {
  return await page.evaluate(() => {
    const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
    const text = element => compact(element?.textContent);
    const section = document.querySelector('.section_entry');
    const headword = text(section?.querySelector('.entry_title .word'));
    const header = section?.innerText ?? '';
    const matchPron = label => header.match(new RegExp(`(?:^|\\n)${label}\\s*\\[\\s*([^\\]]+)\\]`, 'i'))?.[1]?.trim() ?? null;
    const groups = [...document.querySelectorAll('#allMeanGroups .part_area')];
    const senses = [];
    for (const group of groups) {
      const pos = text(group.querySelector('.part_speech')) || 'unclassified';
      const list = group.nextElementSibling;
      if (!list?.classList?.contains('mean_list')) continue;
      let number = 0;
      for (const desc of list.querySelectorAll('.mean_desc')) {
        const item = desc.closest('li.mean_item');
        const meanings = [...desc.querySelectorAll('.mean[lang="ko"]')].map(text).filter(Boolean);
        // A usage note is distinct from a Korean definition.
        const notes = text(desc.querySelector('.cont'));
        const examples = [...(item?.querySelectorAll('.example_item') ?? [])].map(e => ({
          english: text(e.querySelector('.origin .text')),
          translationKo: text(e.querySelector('.translate .text, .translate'))
        })).filter(e => e.english);
        senses.push({
          sourceSenseOrdinal: ++number,
          partOfSpeech: pos,
          level: text(desc.querySelector('.label_grade')) || null,
          meaningsKo: meanings,
          sourceUsageNotes: notes,
          examples
        });
      }
    }
    // Oxford thesaurus area is a preview; it is not the complete synonym/antonym set.
    const thesaurus = [...document.querySelectorAll('#searchPage_globalThesaurus a[href*="thesaurus"]')]
      .filter(a => !/View more/i.test(text(a)))
      .map(a => ({ text: text(a), href: a.href })).filter(x => x.text);
    const idioms = [...document.querySelectorAll('#_id_section_saying_idioms a[href*="entry/enko"]')]
      .map(a => ({ phrase: text(a), href: a.href }));
    const sourcePublisher = 'Oxford Advanced Learner’s English-Korean Dictionary (NAVER display)';
    const source = location.href;
    return {
      status: senses.length > 0 ? 'extracted' : 'failed',
      displayedHeadword: headword,
      source,
      sourcePublisher,
      checkedAt: new Date().toISOString(),
      pronunciation: { us: matchPron('US'), gb: matchPron('GB') },
      senses,
      idioms,
      thesaurus,
      extractionLimits: [
        'Only the Oxford entry and visible example rows are included.',
        'The NAVER thesaurus and idiom areas may contain previews, not full inventories.',
        'Etymology, grammatical inflections, original mnemonics and exam usage require separate verification.',
        'Dictionary examples and meanings are reference-only, not licensed for republication.'
      ]
    };
  });
}

async function collectOne(entry) {
  const query = encodeURIComponent(entry.headword);
  await page.goto(`https://en.dict.naver.com/#/search?query=${query}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('#revisionSearchPage_entry .component_keyword').first().waitFor({ state: 'visible', timeout: 30000 });

  // Navigate to the full dictionary entry. The search-card preview contains only the beginner senses.
  const allMeaning = page.locator('#revisionSearchPage_entry a').filter({ hasText: /All meanings?\s*\(\d+\)/i });
  if (await allMeaning.count()) {
    await allMeaning.first().click();
  } else {
    // On a few entries, an exact-entry title link replaces the 'All meaning' link.
    const detail = page.locator('#revisionSearchPage_entry a[href*="entry/enko/"]');
    if (!await detail.count()) throw new Error('No full-entry link in the NAVER result.');
    await detail.first().click();
  }

  await page.locator('.section_entry .entry_title .word').first().waitFor({ state: 'visible', timeout: 30000 });
  const allTab = page.locator('#level_all');
  if (await allTab.count()) await allTab.click();
  await page.locator('#allMeanGroups .part_area').first().waitFor({ state: 'visible', timeout: 20000 });
  const moreExamples = page.getByRole('button', { name: 'View more examples' });
  if (await moreExamples.count()) await moreExamples.first().click();

  const entryData = await extractVisibleEntry();
  const displayed = entryData.displayedHeadword.toLowerCase().replace(/[^a-z]/g, '');
  const expected = entry.headword.toLowerCase().replace(/[^a-z]/g, '');
  if (!displayed.startsWith(expected)) throw new Error(`Headword mismatch: expected ${expected}, got ${displayed}`);
  if (!entryData.senses.length) throw new Error('No meanings in full Oxford entry.');
  return entryData;
}

try {
  for (const entry of input.entries) {
    const started = Date.now();
    let result;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        result = await collectOne(entry);
        break;
      } catch (error) {
        result = {
          status: 'failed', source: null, pronunciation: {us:null,gb:null},
          senses: [], idioms: [], thesaurus: [], extractionLimits: [],
          error: String(error?.message ?? error), attempts: attempt
        };
      }
    }
    const elapsedMs = Date.now() - started;
    const item = { ...entry, ...result, elapsedMs };
    raw.push(item);
    const summary = normalizeReportEntry(entry, result, elapsedMs);
    if (result.error) summary.error = result.error;
    reportEntries.push(summary);
    console.log(`${entry.entryId} ${entry.headword}: ${summary.status}, ${summary.sensesTotal} senses, ${elapsedMs} ms`);
  }
} finally {
  await context.close();
  await browser.close();
}

mkdirSync('artifacts', { recursive: true });
const full = {
  schemaVersion: 1, pilotOnly: true,
  sourceConsent: { status: 'pending', scope: '10 elementary entry groups; no redistribution approval' },
  sourceOriginal: input.source,
  startedAt, finishedAt: new Date().toISOString(), entries: raw
};
const rawBytes = JSON.stringify(full, null, 2) + '\n';
// Temporary local file in the runner only. Do not upload/copy Oxford full text to this public repo.
writeFileSync('artifacts/runner-only-raw.json', rawBytes);
const report = summarize(reportEntries, startedAt, full.finishedAt);
report.schemaVersion = 1;
report.pilotOnly = true;
report.rawSha256 = createHash('sha256').update(rawBytes).digest('hex');
report.note = 'Public artifact has counts, source links and pronunciations, not copyrighted full definitions/examples.';
writeFileSync('artifacts/public-coverage-report.json', JSON.stringify(report, null, 2) + '\n');
writeFileSync('artifacts/public-coverage-report.md', [
  '## 네이버 초등 10개 조사 실행 결과',
  '',
  `- 시작: ${report.startedAt}`,
  `- 종료: ${report.finishedAt}`,
  `- 전체 소요: ${(report.elapsedMs / 1000).toFixed(1)}초`,
  `- 정상 추출: ${report.extracted}/${report.requested}`,
  `- 의미 항목: ${report.totalSenses}개`,
  `- 뜻별 예문 행: ${report.totalExamplePairs}개`,
  '',
  '| 단어 | 상태 | 의미 수 | 예문 수 | 소요(초) |',
  '|---|---|---:|---:|---:|',
  ...report.entries.map(x => `| ${x.headword} | ${x.status} | ${x.sensesTotal} | ${x.examplePairsFound} | ${(x.elapsedMs / 1000).toFixed(1)} |`),
  '',
  '원문 데이터는 공개 저장소에 게시하지 않습니다. 단어 전체 정보를 최종 학습 데이터로 승인·가공하는 작업은 별도입니다.'
].join('\n') + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, readFileSync('artifacts/public-coverage-report.md'));
}
if (report.failed) process.exitCode = 2;
