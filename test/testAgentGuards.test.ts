import { AgentSession } from "../src/ipc/components/agent";
import { RepeatGuard } from "../src/ipc/components/repeatGuard";
import { decisionNote } from "../src/ipc/components/changes";
import { stripReasoning } from "../src/ai-bridge";

describe("RepeatGuard", () => {
  test("streak counts consecutive identical signatures only", () => {
    const g = new RepeatGuard();
    expect(g.record("a")).toEqual({ dupStreak: 0, lifetimeCount: 1 });
    expect(g.record("a")).toEqual({ dupStreak: 1, lifetimeCount: 2 });
    expect(g.record("b")).toEqual({ dupStreak: 0, lifetimeCount: 1 });
    expect(g.record("a")).toEqual({ dupStreak: 0, lifetimeCount: 3 });
    expect(g.record("a")).toEqual({ dupStreak: 1, lifetimeCount: 4 });
    expect(g.record("a")).toEqual({ dupStreak: 2, lifetimeCount: 5 });
  });

  test("sameAsLast is true only when the result did not change", () => {
    const g = new RepeatGuard();
    expect(g.sameAsLast("a", "v1")).toBe(false);
    expect(g.sameAsLast("a", "v1")).toBe(true);
    expect(g.sameAsLast("a", "v2")).toBe(false);
    expect(g.sameAsLast("a", "v2")).toBe(true);
  });

  test("reset forgets streaks, counts, and results", () => {
    const g = new RepeatGuard();
    g.record("a");
    g.record("a");
    g.sameAsLast("a", "v");
    g.reset();
    expect(g.record("a")).toEqual({ dupStreak: 0, lifetimeCount: 1 });
    expect(g.sameAsLast("a", "v")).toBe(false);
  });
});

describe("AgentSession notes and plan", () => {
  test("note appends a user message and resets the live guard", () => {
    const s = new AgentSession();
    s.guard = new RepeatGuard();
    s.guard.record("a");
    s.guard.record("a");
    s.note("[system] x");
    expect(s.history).toEqual([{ role: "user", content: "[system] x" }]);
    expect(s.guard.record("a").dupStreak).toBe(0);
  });

  test("clearPlan empties the plan and notes it", () => {
    const s = new AgentSession();
    s.plan = [{ text: "a", status: "done" }];
    s.clearPlan();
    expect(s.plan).toEqual([]);
    expect(s.history[0].content).toMatch(/user cleared the task plan/);
  });

  test("snapshot and restore carry the plan", () => {
    const s = new AgentSession();
    s.plan = [{ text: "a", status: "pending" }];
    const snap = s.snapshot();
    expect(snap.plan).toEqual(s.plan);
    const t = new AgentSession();
    t.restore(snap);
    expect(t.plan).toEqual(s.plan);
    t.restore({});
    expect(t.plan).toEqual([]);
  });

  test("clearHistory drops the plan too", () => {
    const s = new AgentSession();
    s.plan = [{ text: "a", status: "pending" }];
    s.clearHistory();
    expect(s.plan).toEqual([]);
  });
});

describe("decisionNote", () => {
  test("applied with nothing pending asks for verification", () => {
    const text = decisionNote("chg-1", { status: "applied", filePath: "/f.js" }, 0);
    expect(text).toBe(
      "[system] Change chg-1 for /f.js was applied. No changes remain pending. The edits are on disk. Verify them with the project's test or lint command when one exists, then mark the plan step done.",
    );
  });

  test("applied with changes pending does not nag yet", () => {
    const text = decisionNote("chg-1", { status: "applied", filePath: "/f.js" }, 2);
    expect(text).toBe("[system] Change chg-1 for /f.js was applied. 2 change(s) still pending review.");
  });

  test("rejected never asks for verification", () => {
    const text = decisionNote("chg-1", { status: "rejected" }, 0);
    expect(text).toBe("[system] Change chg-1 for a file was rejected. No changes remain pending.");
  });
});

describe("stripReasoning", () => {
  test("removes reasoning_content and shares untouched messages", () => {
    const plain = { role: "user", content: "u" };
    const rich = { role: "assistant", content: "c", reasoning_content: "r", tool_calls: [] };
    const out = stripReasoning([plain, rich]);
    expect(out[0]).toBe(plain);
    expect(out[1]).toEqual({ role: "assistant", content: "c", tool_calls: [] });
    expect(rich.reasoning_content).toBe("r");
  });
});
