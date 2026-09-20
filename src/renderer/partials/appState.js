/**
 * App-level UI state persisted to localStorage as one JSON blob.
 * Covers the fields that survive a restart but do not belong to a
 * chat session: last folder, open file, browser pane geometry.
 * Session state (messages, model) lives in src/session-system.
 */
const KEY = "golem.appState";

const DEFAULTS = {
  folderPath: "",
  viewingFile: "",
  browserVisible: false,
  browserWidth: 200,
};

export function loadAppState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAppState(patch) {
  const current = loadAppState();
  localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
}
