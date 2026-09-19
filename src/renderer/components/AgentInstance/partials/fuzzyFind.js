// fuzzyFind.js
// Fzf-style fuzzy matching: every query character must appear in the
// text in order, but not necessarily adjacent. Consecutive runs and
// word boundaries score higher.

/**
 * Score a query against a text. Returns -1 when the query does not
 * match as a subsequence, otherwise a score where higher is better.
 * @param {string} query - The search query.
 * @param {string} text - The candidate text.
 * @returns {number} The match score, or -1 when there is no match.
 */
export function fuzzyScore(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let ti = 0;
  let score = 0;
  let prevMatch = -2;
  for (const ch of q) {
    const idx = t.indexOf(ch, ti);
    if (idx === -1) return -1;
    if (idx === prevMatch + 1) score += 10;
    if (idx === 0 || /[\s\-_./:]/.test(t[idx - 1])) score += 5;
    score += 1;
    prevMatch = idx;
    ti = idx + 1;
  }
  return score;
}

/**
 * Filter and rank items by fuzzy score. An empty query returns the
 * items unchanged. Matching items sort by descending score.
 * @param {string[]} items - The candidate strings.
 * @param {string} query - The search query.
 * @returns {string[]} The matching items, best first.
 */
export function fuzzyFilter(items, query) {
  if (!query) return items;
  return items
    .map((item) => ({ item, score: fuzzyScore(query, item) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);
}
