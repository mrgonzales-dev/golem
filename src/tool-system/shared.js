/**
 * Helpers shared by every tool group: path resolution, the folder
 * guard, numeric clamps, and the read tracker that gates writes.
 */
const fs = require("fs");
const path = require("path");

function resolvePath(p, folderPath) {
  if (!p) return p;
  if (path.isAbsolute(p)) return p;
  if (folderPath) return path.resolve(folderPath, p);
  return path.resolve(p);
}

function requireFolder(folderPath) {
  if (!folderPath) {
    throw new Error(
      "No folder selected. Ask the user to select a folder first.",
    );
  }
}

/**
 * Clamp a model-supplied count to [1, max], or use the fallback.
 * @param {*} value - The raw argument.
 * @param {number} fallback - Used when value is missing or invalid.
 * @param {number} max - The hard cap.
 * @returns {number} A positive integer.
 */
function clampResults(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

// Tracks files read via readFile: path -> { mtimeMs }. Write tools
// refuse to touch a file the model has not read, and the approval
// path re-checks the mtime to catch changes made while pending.
const readTracker = new Map();

/**
 * Record a file as read/current after a read or an applied write.
 * @param {string} resolved - The absolute file path.
 */
function markFileRead(resolved) {
  readTracker.set(resolved, { mtimeMs: fs.statSync(resolved).mtimeMs });
}

/**
 * Snapshot the read tracker for session persistence.
 * @returns {string[]} The absolute paths the model has read.
 */
function serializeReads() {
  return [...readTracker.keys()];
}

/**
 * Rebuild the read tracker from a session snapshot. Paths that no
 * longer exist are dropped so a later write still forces a re-read.
 * Replaces rather than merges: reads from the current run must not
 * leak into the restored session.
 * @param {string[]} paths - The absolute paths from serializeReads.
 */
function restoreReads(paths) {
  readTracker.clear();
  for (const p of paths || []) {
    if (typeof p === "string" && fs.existsSync(p)) markFileRead(p);
  }
}

/**
 * Recover read paths from a conversation history that predates the
 * reads snapshot. Walks assistant readFile calls and resolves each
 * path against the folder the session used.
 * @param {object[]} history - The API message history.
 * @param {string} folderPath - The working directory of the session.
 * @returns {string[]} The absolute paths of files that were read.
 */
function readsFromHistory(history, folderPath) {
  const paths = new Set();
  for (const msg of history || []) {
    if (msg.role !== "assistant" || !Array.isArray(msg.tool_calls)) continue;
    for (const call of msg.tool_calls) {
      if (call.function?.name !== "readFile") continue;
      try {
        const { filePath } = JSON.parse(call.function.arguments || "{}");
        if (filePath) paths.add(resolvePath(filePath, folderPath));
      } catch {}
    }
  }
  return [...paths];
}

module.exports = {
  resolvePath,
  requireFolder,
  clampResults,
  readTracker,
  markFileRead,
  serializeReads,
  restoreReads,
  readsFromHistory,
};
