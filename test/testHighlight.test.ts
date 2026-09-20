import { describe, test, expect } from "vitest";
import {
  languageForPath,
  highlightLines,
} from "@/renderer/components/AgentInstance/components/filePane/partials/highlight";

describe("languageForPath", () => {
  test("maps common extensions through highlight.js aliases", () => {
    expect(languageForPath("src/app.js")).toBe("javascript");
    expect(languageForPath("src/app.ts")).toBe("typescript");
    expect(languageForPath("src/app.py")).toBe("python");
  });

  test("maps extensions missing from highlight.js to a close language", () => {
    expect(languageForPath("src/Component.vue")).toBe("xml");
    expect(languageForPath("src/App.jsx")).toBe("javascript");
    expect(languageForPath("src/App.tsx")).toBe("typescript");
  });

  test("resolves the extension on windows-style paths", () => {
    expect(languageForPath("C:\\repo\\src\\app.py")).toBe("python");
  });

  test("returns an empty string for unknown or missing extensions", () => {
    expect(languageForPath("README")).toBe("");
    expect(languageForPath("archive.zzznotalang")).toBe("");
    expect(languageForPath(".gitignore")).toBe("");
  });
});

describe("highlightLines", () => {
  test("returns an empty array for empty content", () => {
    expect(highlightLines("", "a.js")).toEqual([]);
  });

  test("returns one html string per source line", () => {
    expect(highlightLines("a\nb\nc", "a.txt")).toHaveLength(3);
    expect(highlightLines("a\n", "a.txt")).toEqual(["a", ""]);
  });

  test("escapes html when no language matches", () => {
    const lines = highlightLines("<div>hi</div>", "a.txt");
    expect(lines).toEqual(["&lt;div&gt;hi&lt;/div&gt;"]);
  });

  test("emits hljs spans for a known language", () => {
    const lines = highlightLines("const x = 1;", "a.js");
    expect(lines[0]).toContain("hljs-");
    expect(lines[0]).toContain("const");
  });

  test("keeps every line's tags balanced across multi-line tokens", () => {
    const lines = highlightLines("/* start\nend */", "a.js");
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const opens = (line.match(/<span/g) || []).length;
      const closes = (line.match(/<\/span>/g) || []).length;
      expect(opens).toBe(closes);
    }
    expect(lines[0]).toContain("hljs-comment");
    expect(lines[1]).toContain("hljs-comment");
  });

  test("unknown extension still splits and escapes like plaintext", () => {
    const lines = highlightLines("a < b\n<c>", "a.zzznotalang");
    expect(lines).toEqual(["a &lt; b", "&lt;c&gt;"]);
  });
});
