import * as fs from "fs";
import * as path from "path";
import {
  buildSystemPrompt,
  projectSection,
  topLevelEntries,
  projectDoc,
  toolchainHints,
  reasoningSection,
  toolsSection,
} from "../src/prompts";

describe("prompts project map", () => {
  const tmpDir = path.join(__dirname, "tmp-prompts");

  beforeAll(() => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".hidden"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "node_modules"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "b.txt"), "");
    fs.writeFileSync(path.join(tmpDir, "a.txt"), "");
    fs.writeFileSync(
      path.join(tmpDir, "package.json"),
      JSON.stringify({ scripts: { test: "vitest run", build: "vite build" } }),
    );
    fs.writeFileSync(path.join(tmpDir, "pnpm-lock.yaml"), "");
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Readme\n" + "r".repeat(4000));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test("topLevelEntries lists folders first and skips hidden and node_modules", () => {
    expect(topLevelEntries(tmpDir)).toEqual([
      "src/",
      "README.md",
      "a.txt",
      "b.txt",
      "package.json",
      "pnpm-lock.yaml",
    ]);
  });

  test("toolchainHints reads scripts and the lockfile", () => {
    expect(toolchainHints(tmpDir)).toEqual([
      "Package manager: pnpm.",
      "pnpm run test -> vitest run",
      "pnpm run build -> vite build",
    ]);
  });

  test("projectDoc prefers AGENTS.md and truncates long docs", () => {
    const readme = projectDoc(tmpDir);
    expect(readme.name).toBe("README.md");
    expect(readme.text).toMatch(/\[README.md truncated; readFile for the rest\]$/);
    expect(readme.text.length).toBeLessThan(3100);

    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "rules");
    expect(projectDoc(tmpDir)).toEqual({ name: "AGENTS.md", text: "rules" });
    fs.rmSync(path.join(tmpDir, "AGENTS.md"));
  });

  test("projectSection is empty without a folder", () => {
    expect(projectSection("")).toBe("");
    expect(projectSection("/no/such/dir")).toBe("");
  });

  test("projectSection assembles the map", () => {
    const text = projectSection(tmpDir);
    expect(text).toMatch(/^## Project map/);
    expect(text).toContain("Top level:\n- src/");
    expect(text).toContain("Toolchain:\n- Package manager: pnpm.");
    expect(text).toContain("README.md (project rules; follow them):");
    // tmpDir sits inside the repo, so git status resolves the parent.
    expect(text).toContain("Git status:");
  });

  test("buildSystemPrompt places the map before the reasoning rules", () => {
    const text = buildSystemPrompt(tmpDir);
    expect(text.indexOf("## Project map")).toBeGreaterThan(text.indexOf("## Environment"));
    expect(text.indexOf("## Project map")).toBeLessThan(text.indexOf("## Reasoning"));
  });

  test("buildSystemPrompt without a folder has no map", () => {
    expect(buildSystemPrompt("")).not.toContain("## Project map");
  });
});

describe("prompts guidance", () => {
  test("reasoning section asks for a plan on non-trivial tasks", () => {
    const text = reasoningSection();
    expect(text).toContain("updatePlan");
    expect(text).toContain("Trivial task: act at once.");
    expect(text).not.toContain("do not deliberate");
  });

  test("tools section lists updatePlan and the default skills", () => {
    const text = toolsSection();
    expect(text).toContain("updatePlan, invokeSkill.");
    expect(text).toContain("debug-failure, explore-repo, safe-refactor, write-test");
  });
});
