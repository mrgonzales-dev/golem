import {
  countLines,
  shouldChip,
  makeBlock,
  readNodes,
  PASTE_LINE_LIMIT,
  PASTE_CHAR_LIMIT,
} from "../src/renderer/components/AgentInstance/partials/pastedBlocks";

function textNode(value) {
  return { nodeType: 3, nodeValue: value };
}

function elemNode({ tag = "DIV", chipId = null, kids = [] } = {}) {
  return {
    nodeType: 1,
    tagName: tag,
    dataset: chipId === null ? {} : { bid: String(chipId) },
    classList: { contains: (name) => name === "paste-chip" && chipId !== null },
    childNodes: kids,
  };
}

describe("pastedBlocks", () => {
  test("countLines counts newline rows", () => {
    expect(countLines("one")).toBe(1);
    expect(countLines("a\nb\nc")).toBe(3);
    expect(countLines("")).toBe(0);
  });

  test("shouldChip trips on long or wide pastes only", () => {
    expect(shouldChip("short")).toBe(false);
    expect(shouldChip("a\nb\nc\nd\ne\nf\ng")).toBe(true);
    expect(shouldChip("x".repeat(PASTE_CHAR_LIMIT + 1))).toBe(true);
    expect(shouldChip("a\nb\nc")).toBe(false);
  });

  test("makeBlock stores text plus line count", () => {
    const block = makeBlock("a\nb\nc\nd\ne\nf\ng\nh");
    expect(block.lines).toBe(8);
    expect(block.text).toBe("a\nb\nc\nd\ne\nf\ng\nh");
  });

  test("readNodes keeps word order around chips", () => {
    const block = makeBlock("L1\nL2\nL3\nL4\nL5\nL6");
    const byId = new Map([[String(block.id), block.text]]);
    const nodes = [
      textNode("hey read this "),
      elemNode({ tag: "SPAN", chipId: block.id }),
      textNode(" ?"),
    ];
    expect(readNodes(nodes, byId)).toBe(`hey read this ${block.text} ?`);
  });

  test("readNodes drops chips missing from the store", () => {
    const nodes = [textNode("hi "), elemNode({ tag: "SPAN", chipId: 999 })];
    expect(readNodes(nodes, new Map())).toBe("hi ");
  });

  test("readNodes turns breaks and divs into newlines", () => {
    const nodes = [textNode("a"), elemNode({ tag: "BR" }), elemNode({ tag: "DIV", kids: [textNode("b")] })];
    expect(readNodes(nodes, new Map())).toBe("a\nb\n");
  });

  test("limits stay sane", () => {
    expect(PASTE_LINE_LIMIT).toBeGreaterThan(0);
    expect(PASTE_CHAR_LIMIT).toBeGreaterThan(0);
  });
});
