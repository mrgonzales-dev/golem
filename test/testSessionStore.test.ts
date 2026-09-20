import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

let store: typeof import("@/session-system/sessionStore");
let pending: typeof import("@/diff-system/pendingChanges");
let dir: string;

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "golem-sessions-"));
  process.env.GOLEM_SESSIONS_DIR = dir;
  vi.resetModules();
  store = await import("@/session-system/sessionStore");
  pending = await import("@/diff-system/pendingChanges");
});

afterEach(() => {
  delete process.env.GOLEM_SESSIONS_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
  vi.useRealTimers();
});

describe("saveSession", () => {
  test("writes <id>.json and stamps version and updatedAt", () => {
    const result = store.saveSession({ id: "s1", title: "t" });
    expect(result.ok).toBe(true);
    const file = path.join(dir, "s1.json");
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    expect(saved.version).toBe(1);
    expect(saved.updatedAt).toBeGreaterThan(0);
  });

  test("fails when the session has no id", () => {
    expect(store.saveSession({ title: "x" }).ok).toBe(false);
  });
});

describe("loadSession", () => {
  test("round-trips the saved session", () => {
    store.saveSession({ id: "s1", title: "t", messages: [{ sender: "You", text: "hi" }] });
    const s = store.loadSession("s1");
    expect(s.title).toBe("t");
    expect(s.messages).toHaveLength(1);
  });

  test("returns null for an unknown id", () => {
    expect(store.loadSession("nope")).toBeNull();
  });

  test("returns null for a corrupt file", () => {
    fs.writeFileSync(path.join(dir, "bad.json"), "{broken");
    expect(store.loadSession("bad")).toBeNull();
  });
});

describe("loadLatestSession", () => {
  test("returns the session with the newest updatedAt", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    store.saveSession({ id: "old", title: "old" });
    vi.setSystemTime(2000);
    store.saveSession({ id: "new", title: "new" });
    expect(store.loadLatestSession().id).toBe("new");
  });

  test("returns null when no sessions exist", () => {
    expect(store.loadLatestSession()).toBeNull();
  });
});

describe("listSessions", () => {
  test("returns summaries sorted by updatedAt descending", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    store.saveSession({ id: "a", title: "first", folderPath: "/x" });
    vi.setSystemTime(3000);
    store.saveSession({ id: "b", title: "second", folderPath: "/y" });
    const list = store.listSessions();
    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
    expect(list[0].folderPath).toBe("/y");
    expect(list[0].messages).toBeUndefined();
  });

  test("skips corrupt files instead of failing", () => {
    store.saveSession({ id: "good", title: "ok" });
    fs.writeFileSync(path.join(dir, "bad.json"), "nope{");
    expect(store.listSessions().map((s) => s.id)).toEqual(["good"]);
  });

  test("returns an empty array when the directory is missing", () => {
    fs.rmSync(dir, { recursive: true });
    expect(store.listSessions()).toEqual([]);
  });
});

describe("deleteSession", () => {
  test("removes the file", () => {
    store.saveSession({ id: "s1" });
    expect(store.deleteSession("s1")).toBe(true);
    expect(store.loadSession("s1")).toBeNull();
  });

  test("returns false for an unknown id", () => {
    expect(store.deleteSession("nope")).toBe(false);
  });
});

describe("pendingChanges serialize/restore", () => {
  test("serialize returns an empty array when nothing is pending", () => {
    expect(pending.serialize()).toEqual([]);
  });

  test("serialize keeps the full change including staged content", () => {
    pending.propose(null, {
      filePath: "/f/a.js",
      tool: "writeFile",
      hunks: [],
      stagedContent: "x",
      stagedMtime: 1,
    });
    const entries = pending.serialize();
    expect(entries).toHaveLength(1);
    expect(entries[0].stagedContent).toBe("x");
    expect(entries[0].id).toMatch(/^chg-/);
  });

  test("restore repopulates the map so decisions still work", () => {
    pending.propose(null, {
      filePath: "/f/a.js",
      tool: "writeFile",
      hunks: [],
      stagedContent: "x",
      stagedMtime: null,
    });
    const saved = pending.serialize();
    pending.rejectAll();
    expect(pending.count()).toBe(0);
    pending.restore(saved);
    expect(pending.count()).toBe(1);
    const found = pending.findByPath("/f/a.js");
    expect(found.id).toBe(saved[0].id);
    expect(pending.decide(found.id, false).status).toBe("rejected");
  });

  test("restore replaces the map instead of merging into it", () => {
    pending.propose(null, { filePath: "/f/old.js", tool: "writeFile", hunks: [], stagedContent: "a", stagedMtime: null });
    const saved = pending.serialize();
    pending.propose(null, { filePath: "/f/newer.js", tool: "writeFile", hunks: [], stagedContent: "b", stagedMtime: null });
    pending.restore(saved);
    expect(pending.count()).toBe(1);
    expect(pending.findByPath("/f/newer.js")).toBeNull();
    expect(pending.findByPath("/f/old.js")).not.toBeNull();
  });
});

describe("deriveTitle", () => {
  test("uses the first user message text", async () => {
    const { deriveTitle } = await import("@/session-system/sessionSync");
    expect(deriveTitle([{ sender: "You", text: "fix the bug" }])).toBe("fix the bug");
  });

  test("truncates long titles", async () => {
    const { deriveTitle } = await import("@/session-system/sessionSync");
    const title = deriveTitle([{ sender: "You", text: "x".repeat(80) }]);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  test("falls back to a placeholder without user messages", async () => {
    const { deriveTitle } = await import("@/session-system/sessionSync");
    expect(deriveTitle([])).toBe("New session");
    expect(deriveTitle([{ sender: "AI", text: "hi" }])).toBe("New session");
  });
});

describe("scheduleSessionSave", () => {
  test("sends a deep-cloned plain payload after the debounce", async () => {
    const saveSession = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("window", { api: { saveSession } });
    vi.useFakeTimers();
    const { scheduleSessionSave } = await import(
      "@/session-system/sessionSync"
    );
    const msg = { sender: "You", text: "hi" };
    scheduleSessionSave(() => ({
      messages: [msg],
      folderPath: "/f",
      selectedModel: "m",
      thinkingEffort: "off",
    }));
    vi.advanceTimersByTime(300);
    expect(saveSession).toHaveBeenCalledOnce();
    const payload = saveSession.mock.calls[0][0];
    // IPC structured clone rejects Vue proxies — the payload must be
    // a plain deep clone, never the same references.
    expect(payload.messages[0]).toEqual(msg);
    expect(payload.messages[0]).not.toBe(msg);
    expect(payload.folderPath).toBe("/f");
    vi.unstubAllGlobals();
  });
});
