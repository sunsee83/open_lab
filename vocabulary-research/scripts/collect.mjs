import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { appendFileSync } from 'node:fs';
import { evaluateCapture, sealCapture, verifySealedCapture, sha256 } from './source-preserve.mjs';

const input = JSON.parse(readFileSync(new URL('../words-elementary-pilot.json', import.meta.url), 'utf8'));
if (input.group !== 'elementary' || input.entries.length !== 10 || new Set(input.entries.map(x => x.entryId)).size !== 10) {
  throw new Error('The official pilot input must contain ten unique elementary groups.');
}

// Preserve the original list and query every related spelling as its own source entry.
const targets = input.entries.flatMap(entry => [
  { groupId: entry.entryId, originalGroup: entry.rawEntry, headword: entry.headword, kind: 'main' },
  ...entry.relatedOriginalForms.map(headword => ({
    groupId: entry.entryId, originalGroup: entry.rawEntry, headword, kind: 'listed_related_form'
  }))
]);

const startedAt = new Date().toISOString();
const outputDirectory = process.env.RAW_OUTPUT_DIR
  ? resolve(process.env.RAW_OUTPUT_DIR)
  : mkdtempSync(join(tmpdir(), 'vocabulary-verbatim-'));
mkdirSync(outputDirectory, { recursive: true });
const report = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: 'ko-KR', viewport: { width: 1365, height: 1024 } });
const page = await context.newPage();
page.setDefaultTimeout(12000);

/**
 * Return exactly what the DOM contains. Never trim, collapse whitespace, translate,
 * paraphrase, or generate a missing dictionary field. Metadata and checks are separate.
 */
async function captureRenderedDictionary(expansion) {
  return page.evaluate((expansionInfo) => {
    const fragment = node => node ? {
      textContent: node.textContent,
      outerHTML: node.outerHTML
    } : null;

    const header = document.querySelector('.section_entry');
    const oxfordArea = document.querySelector('.section_mean .component_mean');
    const groupedAreas = [...document.querySelectorAll('#allMeanGroups .part_area')];
    const senses = [];

    const addSense = (description, posNode, ordinal, path) => {
      const item = description.closest('li.mean_item');
      const meanings = [...description.querySelectorAll('.mean[lang="ko"]')];
      const examples = [...(item?.querySelectorAll('.example_item') || [])].map(row => ({
        container: fragment(row),
        english: fragment(row.querySelector('.origin .text')),
        translationKo: fragment(row.querySelector('.translate .text, .translate'))
      }));
      senses.push({
        sourceOrder: senses.length + 1,
        groupOrdinal: ordinal,
        extractionPath: path,
        partOfSpeech: fragment(posNode),
        level: fragment(description.querySelector('.label_grade')),
        usageNote: fragment(description.querySelector('.cont')),
        meaningItems: meanings.map(fragment),
        senseContainer: fragment(item || description),
        examples
      });
    };

    for (const heading of groupedAreas) {
      const list = heading.nextElementSibling;
      if (!list?.classList.contains('mean_list')) continue;
      const posNode = heading.querySelector('.part_speech') || heading;
      let withinGroup = 0;
      for (const description of list.querySelectorAll('.mean_desc')) {
        addSense(description, posNode, ++withinGroup, 'allMeanGroups');
      }
    }

    // Some short Oxford entries have no #allMeanGroups wrapper at all.
    if (!senses.length && oxfordArea) {
      let ordinal = 0;
      for (const description of oxfordArea.querySelectorAll('.mean_desc')) {
        const posNode = description.closest('.mean_tray')?.querySelector('.part_speech')
          || oxfordArea.querySelector('.part_speech');
        addSense(description, posNode, ++ordinal, 'oxfordComponentFallback');
      }
    }

    const links = selector => [...document.querySelectorAll(selector)].map(node => ({
      node: fragment(node),
      hrefAttribute: node.getAttribute('href')
    }));

    return {
      displayedHeadword: fragment(header?.querySelector('.entry_title .word')),
      sourceURL: location.href,
      capturedAt: new Date().toISOString(),
      sourceFragments: {
        header: fragment(header),
        oxfordMeanings: fragment(document.querySelector('#allMeanGroups') || oxfordArea),
        idioms: fragment(document.querySelector('#_id_section_saying_idioms')),
        thesaurus: fragment(document.querySelector('#searchPage_globalThesaurus'))
      },
      pronunciationNodes: [...(header?.querySelectorAll('.entry_pronunciation, .entry_pronounce, .entry_pron') || [])].map(fragment),
      inflectionNodes: [...(header?.querySelectorAll('dl.entry_conjugation') || [])].map(fragment),
      senses,
      idiomLinks: links('#_id_section_saying_idioms a[href*="entry/enko"]'),
      thesaurusPreviewLinks: links('#searchPage_globalThesaurus a[href*="thesaurus"]'),
      expansion: expansionInfo
    };
  }, expansion);
}

async function expandExamples() {
  const buttons = page.getByRole('button', { name: /View more examples|예문 더보기/i });
  let clicked = 0;
  let halted = false;
  // The limit is a safety bound; if any button remains, mark the capture incomplete.
  while (clicked < 150 && await buttons.count()) {
    try {
      const button = buttons.first();
      await button.scrollIntoViewIfNeeded({ timeout: 1500 });
      await button.click({ timeout: 1500 });
      clicked += 1;
    } catch {
      halted = true;
      break;
    }
  }
  return { buttonsClicked: clicked, buttonsRemaining: await buttons.count(), expansionHalted: halted };
}

async function collectOne(target) {
  const query = encodeURIComponent(target.headword);
  await page.goto(`https://en.dict.naver.com/#/search?query=${query}`, {
    waitUntil: 'domcontentloaded', timeout: 12000
  });
  await page.locator('#revisionSearchPage_entry .component_keyword').first().waitFor({
    state: 'visible', timeout: 12000
  });

  const fullEntry = page.locator('#revisionSearchPage_entry a').filter({ hasText: /All meanings?\s*\(\d+\)/i });
  let sourceAdvertisedCount = null;
  let searchLinkText = null;
  let searchLinkOuterHTML = null;
  if (await fullEntry.count()) {
    searchLinkText = await fullEntry.first().textContent();
    searchLinkOuterHTML = await fullEntry.first().evaluate(node => node.outerHTML);
    const match = searchLinkText?.match(/\((\d+)\)/);
    if (match) sourceAdvertisedCount = Number(match[1]);
    await fullEntry.first().click();
  } else {
    const detail = page.locator('#revisionSearchPage_entry a[href*="entry/enko/"]');
    if (!await detail.count()) throw new Error('No Oxford full-entry link found.');
    searchLinkText = await detail.first().textContent();
    searchLinkOuterHTML = await detail.first().evaluate(node => node.outerHTML);
    await detail.first().click();
  }

  await page.locator('.section_entry .entry_title .word').first().waitFor({
    state: 'visible', timeout: 20000
  });
  const allTab = page.locator('#level_all');
  if (await allTab.count()) await allTab.click();

  await page.locator('#allMeanGroups .mean_desc, .section_mean .component_mean .mean_desc')
    .first().waitFor({ state: 'visible', timeout: 15000 });
  const expansion = await expandExamples();
  const capture = await captureRenderedDictionary(expansion);
  const validation = evaluateCapture(capture, target.headword, sourceAdvertisedCount);
  return { capture, validation, lookupMetadata: { searchLinkText, searchLinkOuterHTML, sourceAdvertisedCount } };
}

try {
  let initialNavigationUnavailable = false;
  for (const [index, target] of targets.entries()) {
    const start = Date.now();
    let outcome;
    if (initialNavigationUnavailable) {
      outcome = { status: 'not_attempted', issues: ['initial_navigation_failed'], attempts: 0 };
    } else {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const result = await collectOne(target);
          const sealed = sealCapture({
            schemaVersion: 2,
            source: 'NAVER English Dictionary, Oxford entry attempted (verify sourceURL and stored link markup)',
            sourceList: input.source,
            input: target,
            lookupMetadata: result.lookupMetadata,
            capture: result.capture,
            validation: result.validation
          });
          const filename = `${String(index + 1).padStart(2, '0')}-${target.headword.replace(/[^a-z0-9-]/gi, '_')}.json`;
          const filePath = join(outputDirectory, filename);
          writeFileSync(filePath, JSON.stringify(sealed, null, 2) + '\n');
          if (!verifySealedCapture(JSON.parse(readFileSync(filePath, 'utf8')))) {
            throw new Error('Saved capture checksum mismatch');
          }
          outcome = {
            status: result.validation.status,
            issues: result.validation.issues,
            sourceURL: result.capture.sourceURL,
            counts: result.validation.counts,
            originalCaptureSha256: sealed.integrity.captureSha256,
            fileSha256: sha256(readFileSync(filePath, 'utf8')),
            savedFilename: filename,
            attempts: attempt
          };
          break;
        } catch (error) {
          const message = String(error?.message || error);
          outcome = { status: 'failed', issues: ['collection_error'], error: message, attempts: attempt };
        }
      }
      if (index === 0 && outcome.status === 'failed' && /page\.goto|net::ERR_|Navigation/i.test(outcome.error || '')) {
        initialNavigationUnavailable = true;
      }
    }
    report.push({ ...target, ...outcome, elapsedMs: Date.now() - start });
    console.log(`${target.groupId}/${target.headword}: ${outcome.status}, ${outcome.counts?.senses ?? 0} meanings`);
  }
} finally {
  await context.close();
  await browser.close();
}

const manifest = {
  schemaVersion: 2,
  inputSha256: sha256(input),
  startedAt,
  finishedAt: new Date().toISOString(),
  outputDirectory,
  scope: { originalGroups: input.entries.length, headwordLookups: targets.length },
  rawSourceRecords: report.map(({ groupId, headword, kind, status, issues, sourceURL, originalCaptureSha256, fileSha256, savedFilename }) =>
    ({ groupId, headword, kind, status, issues, sourceURL, originalCaptureSha256, fileSha256, savedFilename })),
  note: 'Each capture is original rendered DOM text and HTML, not AI-written dictionary content.'
};
writeFileSync(join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
const completed = report.filter(x => x.status === 'captured_dom').length;
const needsReview = report.filter(x => x.status === 'needs_review').length;
const failed = report.filter(x => x.status === 'failed').length;
const summary = [
  '## 영어단어 원문 수집 실행 진단',
  '',
  `- 원본 교육부 표제어군: ${input.entries.length}개`,
  `- 실제 조회 요청(관련형 포함): ${targets.length}개`,
  `- DOM 수집 통과: ${completed}개`,
  `- 추가 검토 필요: ${needsReview}개`,
  `- 실패: ${failed}개`,
  `- 미시도: ${report.filter(x => x.status === 'not_attempted').length}개`,
  `- 원문 파일: 실행 환경 임시/지정 저장소에만 기록 (공개 GitHub 업로드 없음)`,
  '',
  ...report.map(x => `- ${x.headword}: ${x.status} · ${x.counts?.senses ?? 0}개 뜻 · ${x.issues?.join(', ') || '기술 검증 통과'}`)
].join('\n') + '\n';
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (failed || needsReview || report.some(x => x.status === 'not_attempted')) process.exitCode = 2;
