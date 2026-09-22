import {
  estimateTokens,
  compactionStage,
  pruneToolResults,
  summaryRequest,
  applySummary,
  DEFAULT_CONTEXT_MAX,
  KEEP_ROUNDS,
} from "../src/context-system/compaction";

// One tool round: an assistant turn with one call plus its result.
function round(i, size = 1000) {
  return [
    {
      role: "assistant",
      content: "",
      reasoning_content: `think ${i}`,
      tool_calls: [{ id: `c${i}`, function: { name: "readFile", arguments: "{}" } }],
    },
    { role: "tool", tool_call_id: `c${i}`, content: "x".repeat(size) },
  ];
}

function history(rounds, size = 1000) {
  const h = [{ role: "system", content: "sys" }, { role: "user", content: "go" }];
  for (let i = 0; i < rounds; i++) h.push(...round(i, size));
  return h;
}

describe("compaction", () => {
  test("estimateTokens counts about one token per four chars", () => {
    const h = [{ role: "user", content: "x".repeat(400) }];
    const json = JSON.stringify(h[0]).length;
    expect(estimateTokens(h)).toBe(Math.ceil(json / 4));
    expect(estimateTokens([])).toBe(0);
  });

  test("compactionStage picks none, prune, or summary by ratio", () => {
    expect(compactionStage(0, 1000)).toBe("none");
    expect(compactionStage(699, 1000)).toBe("none");
    expect(compactionStage(700, 1000)).toBe("prune");
    expect(compactionStage(849, 1000)).toBe("prune");
    expect(compactionStage(850, 1000)).toBe("summary");
  });

  test("compactionStage falls back to the default window", () => {
    expect(compactionStage(DEFAULT_CONTEXT_MAX * 0.9, 0)).toBe("summary");
    expect(compactionStage(100, 0)).toBe("none");
  });

  test("pruneToolResults leaves short histories alone", () => {
    const h = history(KEEP_ROUNDS);
    const out = pruneToolResults(h);
    expect(out.prunedChars).toBe(0);
    expect(out.history).toBe(h);
  });

  test("pruneToolResults stubs old outputs and keeps the tail rounds", () => {
    const h = history(KEEP_ROUNDS + 2);
    const out = pruneToolResults(h);
    const tools = out.history.filter((m) => m.role === "tool");
    expect(tools[0].content).toBe(
      "[readFile output pruned: 1000 chars. Call the tool again if you need it.]",
    );
    expect(tools[1].content).toMatch(/pruned: 1000 chars/);
    for (const m of tools.slice(2)) expect(m.content.length).toBe(1000);
    expect(out.prunedChars).toBe(2000 + "think 0".length + "think 1".length);
  });

  test("pruneToolResults drops old reasoning_content only", () => {
    const h = history(KEEP_ROUNDS + 1);
    const out = pruneToolResults(h);
    const assistants = out.history.filter((m) => m.role === "assistant");
    expect(assistants[0].reasoning_content).toBeUndefined();
    for (const m of assistants.slice(1)) expect(m.reasoning_content).toBeDefined();
  });

  test("pruneToolResults skips outputs under minChars", () => {
    const h = history(KEEP_ROUNDS + 1, 100);
    const out = pruneToolResults(h);
    const tools = out.history.filter((m) => m.role === "tool");
    expect(tools[0].content.length).toBe(100);
  });

  test("pruneToolResults does not mutate the input", () => {
    const h = history(KEEP_ROUNDS + 1);
    const before = JSON.stringify(h);
    pruneToolResults(h);
    expect(JSON.stringify(h)).toBe(before);
  });

  test("pruneToolResults is idempotent on stubs", () => {
    const once = pruneToolResults(history(KEEP_ROUNDS + 1)).history;
    const twice = pruneToolResults(once);
    expect(twice.prunedChars).toBe(0);
  });

  test("summaryRequest asks for a handoff without tools", () => {
    const text = summaryRequest();
    expect(text).toMatch(/Do not call tools/);
    expect(text).toMatch(/next step/);
  });

  test("applySummary keeps the system prompt and one summary note", () => {
    const h = history(2);
    const out = applySummary(h, "  SUMMARY  ", "1. [x] read");
    expect(out.length).toBe(2);
    expect(out[0]).toBe(h[0]);
    expect(out[1].role).toBe("user");
    expect(out[1].content).toMatch(/^\[system\] Older context was compacted/);
    expect(out[1].content).toContain("SUMMARY");
    expect(out[1].content).toContain("Current plan:\n1. [x] read");
    expect(out[1].content).toMatch(/Re-read a file before you edit it/);
  });

  test("applySummary omits the plan block when there is no plan", () => {
    const out = applySummary(history(1), "S", "");
    expect(out[1].content).not.toContain("Current plan:");
  });

  test("applySummary works without a system prompt", () => {
    const out = applySummary([{ role: "user", content: "go" }], "S");
    expect(out.length).toBe(1);
    expect(out[0].role).toBe("user");
  });
});
