import {
  makeTaskBlock,
  taskChipLabel,
  readNodes,
} from "../src/renderer/components/AgentInstance/partials/pastedBlocks";
import {
  toolLabel,
  formatToolArgs,
} from "../src/renderer/components/AgentInstance/partials/toolCalls";

function textNode(value) {
  return { nodeType: 3, nodeValue: value };
}

function chipNode(id) {
  return {
    nodeType: 1,
    tagName: "SPAN",
    dataset: { bid: String(id) },
    classList: { contains: (name) => name === "paste-chip" },
    childNodes: [],
  };
}

describe("task chips", () => {
  test("makeTaskBlock carries number, status, and text", () => {
    const block = makeTaskBlock({ text: "read the loop", status: "in_progress" }, 1);
    expect(block.task).toBe(2);
    expect(block.lines).toBe(1);
    expect(block.text).toBe("Task 2 (in_progress): read the loop");
    expect(taskChipLabel(block)).toBe("[Task 2]");
  });

  test("blocks get unique ids", () => {
    const a = makeTaskBlock({ text: "a", status: "pending" }, 0);
    const b = makeTaskBlock({ text: "b", status: "pending" }, 0);
    expect(a.id).not.toBe(b.id);
  });

  test("readNodes expands a task chip in place", () => {
    const block = makeTaskBlock({ text: "fix it", status: "pending" }, 0);
    const byId = new Map([[String(block.id), block.text]]);
    const nodes = [textNode("please do "), chipNode(block.id), textNode(" now")];
    expect(readNodes(nodes, byId)).toBe("please do Task 1 (pending): fix it now");
  });
});

describe("updatePlan display", () => {
  test("label and progress summary", () => {
    expect(toolLabel("updatePlan")).toBe("Plan");
    expect(
      formatToolArgs("updatePlan", {
        steps: [
          { text: "a", status: "done" },
          { text: "b", status: "verified" },
          { text: "c", status: "pending" },
        ],
      }),
    ).toBe("2/3 steps");
    expect(formatToolArgs("updatePlan", { steps: [] })).toBe("cleared");
    expect(formatToolArgs("updatePlan", {})).toBe("cleared");
  });

  test("search args show the default scope and the glob", () => {
    expect(formatToolArgs("fileSearch", { query: "q" })).toBe('"q" in working directory');
    expect(formatToolArgs("fileGrep", { query: "q", basePath: "/p", glob: "*.vue" })).toBe(
      '"q" in /p (*.vue)',
    );
  });
});
