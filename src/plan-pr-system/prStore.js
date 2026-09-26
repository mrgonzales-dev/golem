/**
 * Pull request registry.
 *
 * The plan mode flow stages one pull request per proposal: the agent
 * writes the plan, the user reviews it on the pull request page, and
 * Implement turns it into pending changes. Nothing here touches disk;
 * serialize/restore hand the registry to session persistence.
 *
 * createPrStore() returns a fresh registry so tests stay isolated.
 */
const PR_STATUSES = new Set(["open", "implemented", "closed"]);

function createPrStore() {
  const prs = new Map();
  let seq = 0;

  /**
   * Register a pull request.
   * @param {object} pr - { title, description, changes }.
   * @returns {string} The pull request id.
   */
  function propose({ title, description, changes } = {}) {
    if (typeof title !== "string" || !title.trim()) {
      throw new Error("Pull request title is required.");
    }
    const now = Date.now();
    const id = `pr-${now}-${++seq}`;
    prs.set(id, {
      title: title.trim(),
      description: typeof description === "string" ? description : "",
      changes: Array.isArray(changes) ? changes : [],
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  function get(id) {
    const pr = prs.get(id);
    return pr ? { id, ...pr } : null;
  }

  /**
   * Summaries for the list page — no change payload. Newest first;
   * same-millisecond entries order by insertion, latest first.
   */
  function list() {
    const out = [...prs.entries()].map(([id, pr], i) => ({
      id,
      _i: i,
      title: pr.title,
      description: pr.description,
      status: pr.status,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
    }));
    out.sort((a, b) => b.updatedAt - a.updatedAt || b._i - a._i);
    return out.map(({ _i, ...rest }) => rest);
  }

  function setStatus(id, status) {
    const pr = prs.get(id);
    if (!pr || !PR_STATUSES.has(status)) return false;
    pr.status = status;
    pr.updatedAt = Date.now();
    return true;
  }

  /**
   * Merge editable fields into a pull request. Status moves only
   * through setStatus; id and timestamps are not patchable.
   */
  function update(id, patch = {}) {
    const pr = prs.get(id);
    if (!pr) return false;
    if ("title" in patch) {
      if (typeof patch.title !== "string" || !patch.title.trim()) return false;
      pr.title = patch.title.trim();
    }
    if ("description" in patch && typeof patch.description === "string") {
      pr.description = patch.description;
    }
    if ("changes" in patch && Array.isArray(patch.changes)) {
      pr.changes = patch.changes;
    }
    pr.updatedAt = Date.now();
    return true;
  }

  function remove(id) {
    return prs.delete(id);
  }

  function count() {
    return prs.size;
  }

  function serialize() {
    return [...prs.entries()].map(([id, pr]) => ({ id, ...pr }));
  }

  function restore(entries) {
    prs.clear();
    for (const { id, ...pr } of entries || []) {
      if (id) prs.set(id, pr);
    }
  }

  return {
    propose,
    get,
    list,
    setStatus,
    update,
    remove,
    count,
    serialize,
    restore,
  };
}

module.exports = { createPrStore, PR_STATUSES };
