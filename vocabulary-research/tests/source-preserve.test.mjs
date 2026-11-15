import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCapture, headwordKey, sealCapture, sha256, verifySealedCapture } from '../scripts/source-preserve.mjs';

function fixture() {
  const raw = '  의미  1\n  있는 그대로!  ';
  return {
    sourceURL: 'https://en.dict.naver.com/#/entry/enko/12345',
    renderedDocumentHTML: '<html>\n <body><div>  가공하지 않은 문장\n!</div></body>\n</html>',
    displayedHeadword: { textContent: 'act', outerHTML: '<span>act</span>' },
    sourceFragments: { header: { outerHTML: '<section>act</section>' } },
    senses: [{
      meaningItems: [{ textContent: raw, outerHTML: `<span>${raw}</span>` }],
      examples: [{ container: { outerHTML: '<li>Sample  —  exactly</li>' }, translationKo: null }]
    }],
    expansion: { buttonsRemaining: 0 }
  };
}

test('원문 공백·줄바꿈·문장부호를 변경하지 않고 저장하고 무결성을 확인한다', () => {
  const capture = fixture();
  const original = capture.senses[0].meaningItems[0].textContent;
  const sealed = sealCapture({ capture });
  const stored = JSON.parse(JSON.stringify(sealed));
  assert.equal(stored.capture.senses[0].meaningItems[0].textContent, original);
  assert.equal(stored.capture.renderedDocumentHTML, capture.renderedDocumentHTML);
  assert.equal(stored.capture.senses[0].meaningItems[0].outerHTML, `<span>${original}</span>`);
  assert.ok(verifySealedCapture(stored));
  assert.equal(stored.integrity.captureSha256, sha256(capture));
  stored.capture.senses[0].meaningItems[0].textContent = 'AI가 작성한 뜻';
  assert.equal(verifySealedCapture(stored), false);
});

test('완전성 근거가 부족하면 완료로 판정하지 않는다', () => {
  const capture = fixture();
  assert.equal(evaluateCapture(capture, 'act', 1).status, 'captured_dom');
  assert.deepEqual(evaluateCapture(capture, 'act', 2).issues, ['advertised_sense_count_mismatch']);
  capture.expansion.buttonsRemaining = 1;
  assert.ok(evaluateCapture(capture, 'act', 1).issues.includes('examples_not_fully_expanded'));
  capture.sourceURL = 'https://en.dict.naver.com/#/search?query=act';
  assert.ok(evaluateCapture(capture, 'act', 1).issues.includes('source_route_not_confirmed'));
  assert.equal(headwordKey('ACT'), 'act');
});
