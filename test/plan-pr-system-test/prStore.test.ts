import { createPrStore } from "../../src/plan-pr-system/prStore";

describe("prStore", () => {
  test("propose returns an id and stores an open pull request", () => {
    const store = createPrStore();
    const id = store.propose({
      title: "Add login form",
      description: "Build the login page.",
      changes: [{ filePath: "/tmp/a.ts", stagedContent: "x" }],
    });
    expect(typeof id).toBe("string");
    const pr = store.get(id);
    expect(pr.title).toBe("Add login form");
    expect(pr.description).toBe("Build the login page.");
    expect(pr.status).toBe("open");
    expect(pr.changes).toHaveLength(1);
    expect(store.count()).toBe(1);
  });

  test("propose throws when title is missing or empty", () => {
    const store = createPrStore();
    expect(() => store.propose({})).toThrow();
    expect(() => store.propose({ title: "  " })).toThrow();
    expect(store.count()).toBe(0);
  });

  test("propose defaults description and changes", () => {
    const store = createPrStore();
    const id = store.propose({ title: "Minimal" });
    const pr = store.get(id);
    expect(pr.description).toBe("");
    expect(pr.changes).toEqual([]);
  });

  test("ids are unique across proposals", () => {
    const store = createPrStore();
    const a = store.propose({ title: "One" });
    const b = store.propose({ title: "Two" });
    expect(a).not.toBe(b);
  });

  test("get returns null for an unknown id", () => {
    const store = createPrStore();
    expect(store.get("pr-nope")).toBeNull();
  });

  test("list returns summaries, newest first", () => {
    const store = createPrStore();
    store.propose({ title: "First" });
    const second = store.propose({ title: "Second" });
    const list = store.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(second);
    // Summaries carry display fields, not the change payload.
    expect(list[0].title).toBe("Second");
    expect(list[0].status).toBe("open");
    expect(list[0].changes).toBeUndefined();
  });

  test("setStatus moves open to implemented", () => {
    const store = createPrStore();
    const id = store.propose({ title: "Work" });
    expect(store.setStatus(id, "implemented")).toBe(true);
    expect(store.get(id).status).toBe("implemented");
  });

  test("setStatus rejects unknown status and unknown id", () => {
    const store = createPrStore();
    const id = store.propose({ title: "Work" });
    expect(store.setStatus(id, "merged")).toBe(false);
    expect(store.setStatus("pr-nope", "closed")).toBe(false);
    expect(store.get(id).status).toBe("open");
  });

  test("update merges fields and bumps updatedAt", () => {
    const store = createPrStore();
    const id = store.propose({ title: "Old title" });
    const before = store.get(id).updatedAt;
    expect(
      store.update(id, { title: "New title", description: "d" }),
    ).toBe(true);
    const pr = store.get(id);
    expect(pr.title).toBe("New title");
    expect(pr.description).toBe("d");
    expect(pr.updatedAt).toBeGreaterThanOrEqual(before);
    expect(store.update("pr-nope", { title: "x" })).toBe(false);
  });

  test("remove deletes the pull request", () => {
    const store = createPrStore();
    const id = store.propose({ title: "Gone" });
    expect(store.remove(id)).toBe(true);
    expect(store.get(id)).toBeNull();
    expect(store.remove(id)).toBe(false);
    expect(store.count()).toBe(0);
  });

  test("serialize and restore round-trip the registry", () => {
    const store = createPrStore();
    store.propose({ title: "A", description: "d", changes: [{ x: 1 }] });
    const snapshot = store.serialize();

    const fresh = createPrStore();
    fresh.propose({ title: "Stale entry" });
    fresh.restore(snapshot);
    expect(fresh.count()).toBe(1);
    expect(fresh.get(snapshot[0].id).title).toBe("A");
  });
});
