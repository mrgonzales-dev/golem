import { normalizeDock, toggleDockMode, loadDockMode, saveDockMode } from "../src/renderer/components/Terminal/terminalDock";

function fakeStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

describe("terminalDock", () => {
  test("normalizeDock keeps side, defaults rest to chat", () => {
    expect(normalizeDock("side")).toBe("side");
    expect(normalizeDock("chat")).toBe("chat");
    expect(normalizeDock("bogus")).toBe("chat");
    expect(normalizeDock(null)).toBe("chat");
    expect(normalizeDock(undefined)).toBe("chat");
  });

  test("toggleDockMode flips side and chat", () => {
    expect(toggleDockMode("chat")).toBe("side");
    expect(toggleDockMode("side")).toBe("chat");
    expect(toggleDockMode("bogus")).toBe("side");
  });

  test("loadDockMode reads storage and falls back to chat", () => {
    expect(loadDockMode(fakeStorage({ terminalDock: "side" }))).toBe("side");
    expect(loadDockMode(fakeStorage({ terminalDock: "nope" }))).toBe("chat");
    expect(loadDockMode(fakeStorage())).toBe("chat");
    expect(loadDockMode(null)).toBe("chat");
  });

  test("saveDockMode writes normalized value", () => {
    const storage = fakeStorage();
    expect(saveDockMode(storage, "side")).toBe("side");
    expect(storage.getItem("terminalDock")).toBe("side");
    expect(saveDockMode(storage, "bogus")).toBe("chat");
    expect(storage.getItem("terminalDock")).toBe("chat");
  });
});
