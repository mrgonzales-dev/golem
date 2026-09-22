import * as fs from "fs";
import * as path from "path";
import {
  globToRegExp,
  updatePlan,
  renderPlan,
  PLAN_STATUSES,
  readsFromHistory,
  serializeReads,
  restoreReads,
  readFile,
  runCommand,
  listSkillNames,
  readOnlyTools,
  toolDefinitions,
  toolFunctions,
} from "../src/tools";

describe("globToRegExp", () => {
  test("bare pattern matches at any depth", () => {
    const re = globToRegExp("*.vue");
    expect(re.test("App.vue")).toBe(true);
    expect(re.test("src/a/B.vue")).toBe(true);
    expect(re.test("src/a/B.vuex")).toBe(false);
    expect(re.test("src/a/B.js")).toBe(false);
  });

  test("double star spans directories", () => {
    const re = globToRegExp("src/**/*.js");
    expect(re.test("src/a.js")).toBe(true);
    expect(re.test("src/x/y/z.js")).toBe(true);
    expect(re.test("test/a.js")).toBe(false);
  });

  test("braces and question mark", () => {
    const re = globToRegExp("*.{js,ts}");
    expect(re.test("a.js")).toBe(true);
    expect(re.test("a.ts")).toBe(true);
    expect(re.test("a.jsx")).toBe(false);
    expect(globToRegExp("f?.txt").test("f1.txt")).toBe(true);
    expect(globToRegExp("f?.txt").test("f/.txt")).toBe(false);
  });

  test("escapes regex characters in the pattern", () => {
    expect(globToRegExp("a.b").test("aXb")).toBe(false);
    expect(globToRegExp("a+b").test("a+b")).toBe(true);
  });
});

describe("updatePlan", () => {
  test("renders a checklist and stores clean steps", () => {
    let stored = null;
    const out = updatePlan(
      { steps: [{ text: " read ", status: "in_progress" }, { text: "fix", status: "bogus" }] },
      "",
      { setPlan: (s) => (stored = s) },
    );
    expect(out).toBe("Plan updated:\n1. [>] read\n2. [ ] fix");
    expect(stored).toEqual([
      { text: "read", status: "in_progress" },
      { text: "fix", status: "pending" },
    ]);
  });

  test("accepts plain strings as steps", () => {
    const out = updatePlan({ steps: ["a", "b"] }, "", {});
    expect(out).toBe("Plan updated:\n1. [ ] a\n2. [ ] b");
  });

  test("empty list clears the plan", () => {
    let stored = null;
    expect(updatePlan({ steps: [] }, "", { setPlan: (s) => (stored = s) })).toBe("Plan cleared.");
    expect(stored).toEqual([]);
  });

  test("rejects a missing array or an empty step", () => {
    expect(() => updatePlan({}, "", {})).toThrow(/must be an array/);
    expect(() => updatePlan({ steps: [{ text: "", status: "done" }] }, "", {})).toThrow(/Step 1 has no text/);
  });

  test("renderPlan marks every status", () => {
    const steps = PLAN_STATUSES.map((status) => ({ text: status, status }));
    expect(renderPlan(steps)).toBe(
      "1. [ ] pending\n2. [>] in_progress\n3. [x] done\n4. [v] verified",
    );
    expect(renderPlan([])).toBe("(no tasks)");
  });

  test("tool definition advertises the statuses", () => {
    const def = toolDefinitions.find((t) => t.function.name === "updatePlan");
    expect(def.function.parameters.properties.steps.items.properties.status.enum).toEqual(PLAN_STATUSES);
    expect(toolFunctions.updatePlan).toBe(updatePlan);
    expect(readOnlyTools.has("updatePlan")).toBe(true);
    expect(readOnlyTools.has("updateFile")).toBe(false);
    expect(readOnlyTools.has("runCommand")).toBe(false);
  });
});

describe("read tracker persistence", () => {
  const tmpDir = path.join(__dirname, "tmp-reads");
  const file = path.join(tmpDir, "r.txt");

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(file, "one\ntwo\n");
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  test("serializeReads lists files read this run", () => {
    restoreReads([]);
    readFile({ filePath: file });
    expect(serializeReads()).toEqual([file]);
  });

  test("restoreReads replaces the set and drops missing files", () => {
    restoreReads([file, path.join(tmpDir, "gone.txt")]);
    expect(serializeReads()).toEqual([file]);
    restoreReads([]);
    expect(serializeReads()).toEqual([]);
  });

  test("readsFromHistory resolves readFile calls against the folder", () => {
    const history = [
      { role: "user", content: "go" },
      {
        role: "assistant",
        tool_calls: [
          { function: { name: "readFile", arguments: JSON.stringify({ filePath: "r.txt" }) } },
          { function: { name: "fileGrep", arguments: JSON.stringify({ query: "x" }) } },
          { function: { name: "readFile", arguments: "{bad" } },
          { function: { name: "readFile", arguments: JSON.stringify({ filePath: file }) } },
        ],
      },
    ];
    expect(readsFromHistory(history, tmpDir)).toEqual([file]);
    expect(readsFromHistory(undefined, tmpDir)).toEqual([]);
  });
});

describe("runCommand", () => {
  const cwd = path.join(__dirname, "..");

  test("returns output and the exit code", async () => {
    const out = await runCommand({ command: "echo hi; exit 3" }, cwd);
    expect(out).toBe("hi\n(exit 3)");
  });

  test("kills the child on abort", async () => {
    const controller = new AbortController();
    const promise = runCommand({ command: "sleep 5" }, cwd, { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    const out = await promise;
    expect(out).toMatch(/interrupted by the user/);
  });

  test("reports a timeout with the seconds used", async () => {
    const out = await runCommand({ command: "sleep 5", timeoutSeconds: 1 }, cwd);
    expect(out).toMatch(/timed out after 1s/);
  }, 5000);
});

describe("skills", () => {
  test("default skills ship and invokeSkill is registered", () => {
    expect(listSkillNames()).toEqual(["debug-failure", "explore-repo", "safe-refactor", "write-test"]);
    expect(toolDefinitions.some((t) => t.function.name === "invokeSkill")).toBe(true);
  });
});
