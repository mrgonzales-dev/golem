import {
  loadPrompts,
  savePrompts,
  addPrompt,
  removePrompt,
  createPrompt,
} from "@/renderer/components/AgentInstance/partials/quickPrompts";

describe("Quick prompts storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("loadPrompts returns empty array when nothing is stored", () => {
    const result = loadPrompts();
    expect(result).toEqual([]);
  });

  test("loadPrompts returns stored prompts", () => {
    const prompts = [
      { id: "1", name: "List files", text: "List the files in the working directory" },
    ];
    localStorage.setItem("quickPrompts", JSON.stringify(prompts));

    const result = loadPrompts();
    expect(result).toEqual(prompts);
  });

  test("loadPrompts returns empty array when stored data is invalid JSON", () => {
    localStorage.setItem("quickPrompts", "not json");

    const result = loadPrompts();
    expect(result).toEqual([]);
  });

  test("savePrompts writes prompts to localStorage", () => {
    const prompts = [
      { id: "1", name: "List files", text: "List the files" },
    ];
    savePrompts(prompts);

    const stored = JSON.parse(localStorage.getItem("quickPrompts"));
    expect(stored).toEqual(prompts);
  });

  test("createPrompt returns a prompt object with id, name, and text", () => {
    const prompt = createPrompt("List files", "List the files in the working directory");

    expect(prompt.id).toBeDefined();
    expect(typeof prompt.id).toBe("string");
    expect(prompt.name).toBe("List files");
    expect(prompt.text).toBe("List the files in the working directory");
  });

  test("createPrompt generates unique ids for different calls", () => {
    const prompt1 = createPrompt("A", "text a");
    const prompt2 = createPrompt("B", "text b");

    expect(prompt1.id).not.toBe(prompt2.id);
  });

  test("addPrompt adds a prompt to the list and persists to localStorage", () => {
    const existing = [
      { id: "1", name: "Old", text: "old text" },
    ];
    const newPrompt = createPrompt("New", "new text");

    const result = addPrompt(existing, newPrompt);

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(newPrompt);

    const stored = JSON.parse(localStorage.getItem("quickPrompts"));
    expect(stored).toEqual(result);
  });

  test("addPrompt does not mutate the original array", () => {
    const existing = [
      { id: "1", name: "Old", text: "old text" },
    ];
    const newPrompt = createPrompt("New", "new text");

    addPrompt(existing, newPrompt);

    expect(existing).toHaveLength(1);
  });

  test("removePrompt removes a prompt by id and persists to localStorage", () => {
    const prompts = [
      { id: "1", name: "A", text: "text a" },
      { id: "2", name: "B", text: "text b" },
      { id: "3", name: "C", text: "text c" },
    ];

    const result = removePrompt(prompts, "2");

    expect(result).toHaveLength(2);
    expect(result.find((p) => p.id === "2")).toBeUndefined();

    const stored = JSON.parse(localStorage.getItem("quickPrompts"));
    expect(stored).toEqual(result);
  });

  test("removePrompt does not mutate the original array", () => {
    const prompts = [
      { id: "1", name: "A", text: "text a" },
      { id: "2", name: "B", text: "text b" },
    ];

    removePrompt(prompts, "1");

    expect(prompts).toHaveLength(2);
  });

  test("removePrompt returns the same list when id is not found", () => {
    const prompts = [
      { id: "1", name: "A", text: "text a" },
    ];

    const result = removePrompt(prompts, "nonexistent");

    expect(result).toHaveLength(1);
    expect(result).toEqual(prompts);
  });
});
