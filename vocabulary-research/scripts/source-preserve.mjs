import { createHash } from 'node:crypto';

/** A checksum for a string or structured record. This never changes source text. */
export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value), 'utf8').digest('hex');
}

/** Comparison only: the untouched spelling stays in the source record. */
export function headwordKey(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
}

export function evaluateCapture(capture, requestedHeadword, advertisedSenseCount = null) {
  const issues = [];
  const displayed = capture?.displayedHeadword?.textContent;
  const header = capture?.sourceFragments?.header?.outerHTML;
  const senses = capture?.senses ?? [];

  if (!header || !displayed) issues.push('missing_entry_header');
  if (!String(capture?.sourceURL || '').includes('/entry/enko/')) issues.push('source_route_not_confirmed');
  if (headwordKey(displayed) !== headwordKey(requestedHeadword)) issues.push('headword_mismatch');
  if (senses.length === 0) issues.push('no_senses');
  if (advertisedSenseCount !== null && advertisedSenseCount !== senses.length) issues.push('advertised_sense_count_mismatch');
  if (senses.some(s => !s.meaningItems?.length || s.meaningItems.some(m => !m?.outerHTML))) issues.push('missing_meaning_markup');
  if (senses.some(s => s.examples?.some(e => !e?.container?.outerHTML))) issues.push('missing_example_markup');
  if (capture?.expansion?.buttonsRemaining > 0) issues.push('examples_not_fully_expanded');

  return {
    status: issues.length ? 'needs_review' : 'captured_dom',
    issues,
    counts: {
      senses: senses.length,
      exampleRows: senses.reduce((n, s) => n + (s.examples?.length ?? 0), 0),
      missingExampleTranslations: senses.reduce((n, s) => n + (s.examples || []).filter(e => !e.translationKo).length, 0)
    },
    limitation: 'A matching DOM snapshot does not prove the website displayed its complete dictionary inventory.'
  };
}

export function sealCapture(record) {
  return { ...record, integrity: { algorithm: 'sha256', captureSha256: sha256(record.capture) } };
}

export function verifySealedCapture(record) {
  return record?.integrity?.algorithm === 'sha256' && record.integrity.captureSha256 === sha256(record.capture);
}
