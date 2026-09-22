/**
 * pastedBlocks.js — collapses long pastes into inline orange chips.
 *
 * A paste over the line or char limit becomes one block in memory
 * plus one atomic chip span at the caret inside the rich editor.
 * Chips sit mid-text in paste order; send reads DOM order via
 * readNodes() so position survives. All helpers stay pure and
 * take node-like objects, so tests run with zero browser APIs.
 */
export const PASTE_LINE_LIMIT = 5;
export const PASTE_CHAR_LIMIT = 500;

let seq = 0;

export function countLines(text) {
  if (!text) return 0;
  return String(text).split("\n").length;
}

export function shouldChip(text) {
  if (!text) return false;
  return countLines(text) > PASTE_LINE_LIMIT || text.length > PASTE_CHAR_LIMIT;
}

export function makeBlock(text) {
  seq += 1;
  return { id: seq, text: String(text), lines: countLines(text) };
}

export function chipLabel(block) {
  return `[Pasted ~${block.lines} lines]`;
}

/**
 * A task from the plan pane, as a chip block. The model receives the
 * step number, its text, and its status so "this task" is unambiguous.
 * @param {{text: string, status: string}} step - The plan step.
 * @param {number} index - Zero-based position in the plan.
 * @returns {{id: number, text: string, lines: number, task: number}} The block.
 */
export function makeTaskBlock(step, index) {
  seq += 1;
  const n = index + 1;
  return {
    id: seq,
    text: `Task ${n} (${step.status}): ${step.text}`,
    lines: 1,
    task: n,
  };
}

export function taskChipLabel(block) {
  return `[Task ${block.task}]`;
}

function nodeText(node, byId) {
  if (node.nodeType === 3) return node.nodeValue || "";
  if (node.nodeType !== 1) return "";
  if (node.classList && node.classList.contains("paste-chip")) {
    return byId.get(String(node.dataset?.bid)) ?? "";
  }
  if (node.tagName === "BR") return "\n";
  const kids = Array.from(node.childNodes || []).map((k) => nodeText(k, byId));
  return kids.join("") + "\n";
}

export function readNodes(nodes, byId) {
  return Array.from(nodes || []).map((n) => nodeText(n, byId)).join("");
}
