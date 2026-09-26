import { describe, expect, test } from "vitest";
import { proposePullRequest } from "../../src/tool-system/pullRequest";
import {
  toolDefinitions,
  toolFunctions,
  readOnlyTools,
} from "../../src/tools";
import { createPrStore } from "../../src/plan-pr-system/prStore";

describe("proposePullRequest tool", () => {
  test("is registered in definitions, functions, and read-only set", () => {
    const def = toolDefinitions.find(
      (t) => t.function.name === "proposePullRequest",
    );
    expect(def).toBeDefined();
    // require() and ESM import yield separate module instances, so
    // assert the registration exposes a callable, not identity.
    expect(toolFunctions.proposePullRequest).toBeTypeOf("function");
    expect(toolFunctions.proposePullRequest.name).toBe("proposePullRequest");
    expect(readOnlyTools.has("proposePullRequest")).toBe(true);
  });

  test("requires a proposePr context hook", () => {
    expect(() =>
      proposePullRequest({ title: "T", description: "d" }, "/tmp"),
    ).toThrow();
  });

  test("creates a pull request through the context hook", () => {
    const calls: unknown[] = [];
    const ctx = {
      proposePr: (pr: unknown) => {
        calls.push(pr);
        return "pr-1";
      },
    };
    const out = proposePullRequest(
      { title: "T", description: "d" },
      "/tmp",
      ctx,
    );
    expect(calls[0]).toEqual({ title: "T", description: "d", prId: undefined });
    expect(out).toContain("pr-1");
    expect(out).toContain("created");
  });

  test("passes prId through for revisions", () => {
    const ctx = { proposePr: () => "pr-9" };
    const out = proposePullRequest(
      { title: "T2", description: "d2", prId: "pr-9" },
      "/tmp",
      ctx,
    );
    expect(out).toContain("pr-9");
    expect(out).toContain("updated");
  });
});

describe("prStore list summaries", () => {
  test("carry title, description, and status for the page", () => {
    const store = createPrStore();
    store.propose({ title: "T", description: "body text" });
    const [summary] = store.list();
    expect(summary.title).toBe("T");
    expect(summary.description).toBe("body text");
    expect(summary.status).toBe("open");
    expect(summary.changes).toBeUndefined();
  });
});
