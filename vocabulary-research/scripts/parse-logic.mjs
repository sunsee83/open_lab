export const text = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

export function normalizeReportEntry({ entryId, headword, rawEntry, relatedOriginalForms }, extracted, elapsedMs) {
  const senses = Array.isArray(extracted.senses) ? extracted.senses : [];
  const byPartOfSpeech = {};
  const byLevel = {};
  for (const sense of senses) {
    const pos = text(sense.partOfSpeech) || 'unknown';
    const level = text(sense.level) || 'unclassified';
    byPartOfSpeech[pos] = (byPartOfSpeech[pos] ?? 0) + 1;
    byLevel[level] = (byLevel[level] ?? 0) + 1;
  }
  return {
    entryId, headword, rawEntry, relatedOriginalForms,
    status: extracted.status,
    source: extracted.source,
    pronunciation: extracted.pronunciation,
    sensesTotal: senses.length,
    byPartOfSpeech,
    byLevel,
    examplePairsFound: senses.reduce((n, s) => n + s.examples.length, 0),
    idiomCount: extracted.idioms.length,
    thesaurusPreviewCount: extracted.thesaurus.length,
    extractionLimits: extracted.extractionLimits,
    elapsedMs
  };
}

export function summarize(entries, startedAt, finishedAt) {
  const completed = entries.filter((entry) => entry.status === 'extracted');
  const totalMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  return {
    startedAt, finishedAt, elapsedMs: totalMs,
    requested: entries.length,
    extracted: completed.length,
    failed: entries.length - completed.length,
    meanPerRequestedMs: entries.length ? Math.round(totalMs / entries.length) : null,
    totalSenses: completed.reduce((n, entry) => n + entry.sensesTotal, 0),
    totalExamplePairs: completed.reduce((n, entry) => n + entry.examplePairsFound, 0),
    entries
  };
}
