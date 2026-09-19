import {
  applyToolCall,
  aggregateStatus,
  toolLabel,
  formatToolArgs,
} from "@/renderer/components/AgentInstance/partials/toolCalls";

describe("Tool call grouping", () => {
  function makeMessages(tools: any[] = []) {
    const msgs: any[] = [{ sender: "You", text: "hi" }];
    for (const t of tools) msgs.push(t);
    msgs.push({ sender: "Thinking", text: "Thinking", elapsed: 0, tokens: 0 });
    return msgs;
  }

  test("first tool call creates a new group", () => {
    const messages = makeMessages();
    const thinkingId = messages.length - 1;

    const result = applyToolCall(messages, thinkingId, {
      tool: "readFile",
      args: { filePath: "package.json" },
      status: "running",
      callId: "a1",
    });

    expect(result.messages).toHaveLength(3);
    expect(result.thinkingId).toBe(2);

    const group = result.messages[1];
    expect(group.sender).toBe("Tool");
    expect(group.tool).toBe("readFile");
    expect(group.items).toHaveLength(1);
    expect(group.items[0].args.filePath).toBe("package.json");
    expect(group.items[0].status).toBe("running");
    expect(group.items[0].callId).toBe("a1");
  });

  test("second tool call of same type adds to existing group", () => {
    const messages = makeMessages([
      {
        sender: "Tool",
        tool: "readFile",
        items: [
          { args: { filePath: "a.txt" }, status: "done", callId: "a1" },
        ],
      },
    ]);
    const thinkingId = messages.length - 1;

    const result = applyToolCall(messages, thinkingId, {
      tool: "readFile",
      args: { filePath: "b.txt" },
      status: "running",
      callId: "a2",
    });

    expect(result.messages).toHaveLength(3);
    expect(result.thinkingId).toBe(2);

    const group = result.messages[1];
    expect(group.items).toHaveLength(2);
    expect(group.items[1].args.filePath).toBe("b.txt");
    expect(group.items[1].status).toBe("running");
  });

  test("tool call of different type creates a new group", () => {
    const messages = makeMessages([
      {
        sender: "Tool",
        tool: "readFile",
        items: [
          { args: { filePath: "a.txt" }, status: "done", callId: "a1" },
        ],
      },
    ]);
    const thinkingId = messages.length - 1;

    const result = applyToolCall(messages, thinkingId, {
      tool: "listDirectory",
      args: { dirPath: "src" },
      status: "running",
      callId: "a2",
    });

    expect(result.messages).toHaveLength(4);
    expect(result.thinkingId).toBe(3);
    expect(result.messages[1].tool).toBe("readFile");
    expect(result.messages[2].tool).toBe("listDirectory");
  });

  test("status update by callId updates the correct item", () => {
    const messages = makeMessages([
      {
        sender: "Tool",
        tool: "readFile",
        items: [
          { args: { filePath: "a.txt" }, status: "done", callId: "a1" },
          { args: { filePath: "b.txt" }, status: "running", callId: "a2" },
        ],
      },
    ]);
    const thinkingId = messages.length - 1;

    const result = applyToolCall(messages, thinkingId, {
      tool: "readFile",
      args: { filePath: "b.txt" },
      status: "done",
      callId: "a2",
    });

    expect(result.messages[1].items).toHaveLength(2);
    expect(result.messages[1].items[0].status).toBe("done");
    expect(result.messages[1].items[1].status).toBe("done");
  });

  test("same tool type after a different tool type creates a new group", () => {
    const messages = makeMessages([
      {
        sender: "Tool",
        tool: "readFile",
        items: [
          { args: { filePath: "a.txt" }, status: "done", callId: "a1" },
        ],
      },
      {
        sender: "Tool",
        tool: "listDirectory",
        items: [
          { args: { dirPath: "src" }, status: "done", callId: "a2" },
        ],
      },
    ]);
    const thinkingId = messages.length - 1;

    const result = applyToolCall(messages, thinkingId, {
      tool: "readFile",
      args: { filePath: "b.txt" },
      status: "running",
      callId: "a3",
    });

    expect(result.messages).toHaveLength(5);
    expect(result.thinkingId).toBe(4);
    expect(result.messages[1].tool).toBe("readFile");
    expect(result.messages[2].tool).toBe("listDirectory");
    expect(result.messages[3].tool).toBe("readFile");
    expect(result.messages[3].items).toHaveLength(1);
  });

  test("does not mutate the original messages array", () => {
    const messages = makeMessages([
      {
        sender: "Tool",
        tool: "readFile",
        items: [
          { args: { filePath: "a.txt" }, status: "done", callId: "a1" },
        ],
      },
    ]);
    const thinkingId = messages.length - 1;
    const originalLength = messages.length;

    applyToolCall(messages, thinkingId, {
      tool: "readFile",
      args: { filePath: "b.txt" },
      status: "running",
      callId: "a2",
    });

    expect(messages).toHaveLength(originalLength);
    expect(messages[1].items).toHaveLength(1);
  });
});

describe("aggregateStatus", () => {
  test("returns running if any item is running", () => {
    const items = [
      { args: {}, status: "done", callId: "1" },
      { args: {}, status: "running", callId: "2" },
      { args: {}, status: "done", callId: "3" },
    ];
    expect(aggregateStatus(items)).toBe("running");
  });

  test("returns error if any item has error and none are running", () => {
    const items = [
      { args: {}, status: "done", callId: "1" },
      { args: {}, status: "error", callId: "2" },
    ];
    expect(aggregateStatus(items)).toBe("error");
  });

  test("returns done if all items are done", () => {
    const items = [
      { args: {}, status: "done", callId: "1" },
      { args: {}, status: "done", callId: "2" },
    ];
    expect(aggregateStatus(items)).toBe("done");
  });

  test("returns done for an empty list", () => {
    expect(aggregateStatus([])).toBe("done");
  });

  test("running takes priority over error", () => {
    const items = [
      { args: {}, status: "error", callId: "1" },
      { args: {}, status: "running", callId: "2" },
    ];
    expect(aggregateStatus(items)).toBe("running");
  });
});

describe("toolLabel", () => {
  test("returns Read for readFile", () => {
    expect(toolLabel("readFile")).toBe("Read");
  });

  test("returns Search for fileSearch", () => {
    expect(toolLabel("fileSearch")).toBe("Search");
  });

  test("returns Grep for fileGrep", () => {
    expect(toolLabel("fileGrep")).toBe("Grep");
  });

  test("returns List for listDirectory", () => {
    expect(toolLabel("listDirectory")).toBe("List");
  });

  test("returns Skill for invokeSkill", () => {
    expect(toolLabel("invokeSkill")).toBe("Skill");
  });

  test("returns the tool name for unknown tools", () => {
    expect(toolLabel("unknownTool")).toBe("unknownTool");
  });
});

describe("formatToolArgs", () => {
  test("formats readFile args as the file path", () => {
    expect(formatToolArgs("readFile", { filePath: "src/config.js" })).toBe(
      "src/config.js",
    );
  });

  test("formats fileSearch args as query in basePath", () => {
    expect(
      formatToolArgs("fileSearch", { query: "test", basePath: "/home" }),
    ).toBe('"test" in /home');
  });

  test("formats fileGrep args as query in basePath", () => {
    expect(
      formatToolArgs("fileGrep", { query: "TODO", basePath: "/src" }),
    ).toBe('"TODO" in /src');
  });

  test("formats listDirectory args as the dir path", () => {
    expect(formatToolArgs("listDirectory", { dirPath: "src" })).toBe("src");
  });

  test("formats listDirectory with no dirPath as working directory", () => {
    expect(formatToolArgs("listDirectory", {})).toBe("working directory");
  });

  test("formats invokeSkill args as the skill name", () => {
    expect(formatToolArgs("invokeSkill", { skillName: "architect" })).toBe(
      "architect",
    );
  });

  test("formats invokeSkill with no skillName as list", () => {
    expect(formatToolArgs("invokeSkill", {})).toBe("list");
  });
});
