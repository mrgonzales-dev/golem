import { describe, test, expect, beforeEach } from "vitest";
import {
  loadAppState,
  saveAppState,
} from "@/renderer/partials/appState";

beforeEach(() => {
  localStorage.clear();
});

describe("loadAppState", () => {
  test("returns defaults when nothing is stored", () => {
    expect(loadAppState()).toEqual({
      folderPath: "",
      viewingFile: "",
      browserVisible: false,
      browserWidth: 200,
    });
  });

  test("merges stored values over the defaults", () => {
    localStorage.setItem(
      "golem.appState",
      JSON.stringify({ folderPath: "/repo/x" }),
    );
    const state = loadAppState();
    expect(state.folderPath).toBe("/repo/x");
    expect(state.browserWidth).toBe(200);
    expect(state.browserVisible).toBe(false);
  });

  test("returns defaults when stored json is corrupt", () => {
    localStorage.setItem("golem.appState", "{not json");
    expect(loadAppState().folderPath).toBe("");
  });

  test("preserves unknown stored keys for forward compatibility", () => {
    localStorage.setItem(
      "golem.appState",
      JSON.stringify({ futureField: 42 }),
    );
    expect(loadAppState().futureField).toBe(42);
  });
});

describe("saveAppState", () => {
  test("writes the patch to storage", () => {
    saveAppState({ folderPath: "/repo/a" });
    expect(loadAppState().folderPath).toBe("/repo/a");
  });

  test("merges successive patches instead of overwriting", () => {
    saveAppState({ folderPath: "/repo/a" });
    saveAppState({ browserVisible: true });
    const state = loadAppState();
    expect(state.folderPath).toBe("/repo/a");
    expect(state.browserVisible).toBe(true);
  });

  test("a later patch overrides the same key", () => {
    saveAppState({ browserWidth: 200 });
    saveAppState({ browserWidth: 320 });
    expect(loadAppState().browserWidth).toBe(320);
  });
});
