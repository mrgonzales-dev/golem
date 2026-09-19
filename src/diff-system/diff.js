/**
 * Diff helpers for pending change cards.
 *
 * hunkForEdit builds a small hunk card around one exact-match edit:
 * a few context lines, the removed lines, then the added lines.
 * lineDiff computes a full line-level diff for whole-file overwrites.
 */

/**
 * Build a hunk card for a single exact-match replacement.
 * @param {string} content - The file content the match was found in.
 * @param {number} matchIndex - The byte index where oldText starts.
 * @param {string} oldText - The text being replaced.
 * @param {string} newText - The replacement text.
 * @param {number} contextLines - Lines of context around the change.
 * @returns {{startLine: number, fromLine: number, lines: Array<{type: string, text: string}>}}
 *   startLine is the 1-based line where oldText starts.
 *   fromLine is the 1-based line of the first rendered line,
 *   which sits contextLines above the match.
 */
function hunkForEdit(content, matchIndex, oldText, newText, contextLines = 3) {
  const lines = content.split("\n");
  const startLine = content.slice(0, matchIndex).split("\n").length - 1;
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  const beforeStart = Math.max(0, startLine - contextLines);
  const before = lines.slice(beforeStart, startLine);
  const after = lines.slice(startLine + oldLines.length, startLine + oldLines.length + contextLines);

  const out = [];
  for (const text of before) out.push({ type: "keep", text });
  for (const text of oldLines) out.push({ type: "remove", text });
  for (const text of newLines) out.push({ type: "add", text });
  for (const text of after) out.push({ type: "keep", text });

  return { startLine: startLine + 1, fromLine: beforeStart + 1, lines: out };
}

/**
 * Compute a line-level diff between two file contents.
 * Falls back to remove-all + add-all when the file pair is too large
 * for the LCS table.
 * @param {string} oldContent - The original content.
 * @param {string} newContent - The new content.
 * @returns {Array<{type: "add"|"remove"|"keep", text: string}>}
 */
function lineDiff(oldContent, newContent) {
  const a = oldContent === "" ? [] : oldContent.split("\n");
  const b = newContent === "" ? [] : newContent.split("\n");

  if (a.length * b.length > 4_000_000) {
    return [
      ...a.map((text) => ({ type: "remove", text })),
      ...b.map((text) => ({ type: "add", text })),
    ];
  }

  const cols = b.length + 1;
  const dp = new Uint32Array((a.length + 1) * cols);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * cols + j] =
        a[i] === b[j]
          ? dp[(i + 1) * cols + j + 1] + 1
          : Math.max(dp[(i + 1) * cols + j], dp[i * cols + j + 1]);
    }
  }

  const changes = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      changes.push({ type: "keep", text: a[i] });
      i++;
      j++;
    } else if (dp[(i + 1) * cols + j] >= dp[i * cols + j + 1]) {
      changes.push({ type: "remove", text: a[i] });
      i++;
    } else {
      changes.push({ type: "add", text: b[j] });
      j++;
    }
  }
  while (i < a.length) changes.push({ type: "remove", text: a[i++] });
  while (j < b.length) changes.push({ type: "add", text: b[j++] });
  return changes;
}

module.exports = { hunkForEdit, lineDiff };
