/**
 * Session file store.
 *
 * One JSON file per session under the app's sessions directory.
 * The directory resolves to GOLEM_SESSIONS_DIR when set (tests),
 * then Electron's userData, then the OS temp dir as a last resort.
 *
 * File shape: { version, id, title, folderPath, selectedModel,
 * thinkingEffort, createdAt, updatedAt, history, messages,
 * pendingChanges }.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const VERSION = 1;

function sessionsDir() {
  if (process.env.GOLEM_SESSIONS_DIR) return process.env.GOLEM_SESSIONS_DIR;
  try {
    const { app } = require("electron");
    return path.join(app.getPath("userData"), "sessions");
  } catch {
    return path.join(os.tmpdir(), "golem-sessions");
  }
}

// Ids come from AgentSession (uuid), but basename guards the path
// join against any id that ever carries separators.
function fileFor(id) {
  return path.join(sessionsDir(), `${path.basename(String(id))}.json`);
}

function loadSession(id) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(id), "utf8"));
  } catch {
    return null;
  }
}

function saveSession(data) {
  if (!data || !data.id) return { ok: false, error: "session id required" };
  try {
    fs.mkdirSync(sessionsDir(), { recursive: true });
    const existing = loadSession(data.id);
    const session = {
      ...data,
      version: VERSION,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    const file = fileFor(data.id);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(session));
    fs.renameSync(tmp, file);
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Summaries only — the picker lists these without paying for
// history/messages payload per entry.
function listSessions() {
  let files;
  try {
    files = fs.readdirSync(sessionsDir()).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    try {
      const s = JSON.parse(
        fs.readFileSync(path.join(sessionsDir(), f), "utf8"),
      );
      out.push({
        id: s.id,
        title: s.title,
        folderPath: s.folderPath,
        updatedAt: s.updatedAt || 0,
      });
    } catch {}
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

function loadLatestSession() {
  const list = listSessions();
  if (!list.length) return null;
  return loadSession(list[0].id);
}

function deleteSession(id) {
  try {
    fs.rmSync(fileFor(id));
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  sessionsDir,
  saveSession,
  loadSession,
  loadLatestSession,
  listSessions,
  deleteSession,
};
