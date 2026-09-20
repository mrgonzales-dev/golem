/**
 * Pending change registry.
 *
 * Write tools stage edits in memory and return immediately, so the
 * agent keeps working. Each proposal lives here until the renderer
 * sends a decision over change:decide. Approve runs a staleness
 * check (disk mtime vs proposal time) before writing to disk.
 */
const fs = require("fs");
const { markFileRead } = require("../tools");

const pending = new Map();
let seq = 0;

/**
 * Register a change and emit its card to the renderer.
 * @param {object} sender - The webContents sender for this chat.
 * @param {object} change - { filePath, tool, hunks, stagedContent, stagedMtime }.
 * @returns {string} The change id.
 */
function propose(sender, change) {
  const id = `chg-${Date.now()}-${++seq}`;
  pending.set(id, change);
  if (sender && sender.send) {
    const { stagedContent, stagedMtime, ...card } = change;
    sender.send("agent:change", { id, status: "pending", ...card });
  }
  return id;
}

/**
 * Apply or discard a pending change from the renderer's decision.
 * Approve checks the file has not changed on disk since the proposal
 * was staged; a mismatch fails the edit as stale.
 * @param {string} id - The change id.
 * @param {boolean} approved - True to approve, false to reject.
 */
function decide(id, approved) {
  const change = pending.get(id);
  if (!change) {
    return { ok: false, error: "No pending change with that id." };
  }

  if (!approved) {
    pending.delete(id);
    return { ok: true, status: "rejected", filePath: change.filePath };
  }

  if (
    change.stagedMtime !== null &&
    fs.statSync(change.filePath).mtimeMs !== change.stagedMtime
  ) {
    pending.delete(id);
    return { ok: false, status: "stale", filePath: change.filePath };
  }

  try {
    fs.writeFileSync(change.filePath, change.stagedContent);
    markFileRead(change.filePath);
    pending.delete(id);
    return { ok: true, status: "applied", filePath: change.filePath };
  } catch (err) {
    return {
      ok: false,
      status: "error",
      error: err.message,
      filePath: change.filePath,
    };
  }
}

/**
 * Count of changes still awaiting a decision.
 * @returns {number}
 */
function count() {
  return pending.size;
}

/**
 * Find the pending change for a file path, if one exists.
 * One file holds at most one pending change.
 * @param {string} filePath - The absolute file path.
 * @returns {object|null} The change plus its id, or null.
 */
function findByPath(filePath) {
  for (const [id, change] of pending) {
    if (change.filePath === filePath) {
      return { id, ...change };
    }
  }
  return null;
}

/**
 * Merge new fields into a pending change and re-emit its card.
 * The renderer replaces the card with the same id.
 * @param {object} sender - The webContents sender for this chat.
 * @param {string} id - The change id.
 * @param {object} patch - Fields to merge, e.g. { hunks, stagedContent }.
 * @returns {boolean} True if the change exists.
 */
function update(sender, id, patch) {
  const change = pending.get(id);
  if (!change) return false;
  Object.assign(change, patch);
  if (sender && sender.send) {
    const { stagedContent, stagedMtime, ...card } = change;
    sender.send("agent:change", { id, status: "pending", ...card });
  }
  return true;
}

/**
 * Discard every pending change. Reserved for a future
 * "reject all" surface.
 */
function rejectAll() {
  pending.clear();
}

module.exports = { propose, decide, findByPath, update, rejectAll, count };
