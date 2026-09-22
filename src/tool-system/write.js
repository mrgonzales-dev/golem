/**
 * Write tools: updateFile and writeFile. Both stage a proposal in the
 * pending change registry; nothing touches disk until the user
 * approves the diff card.
 */
const fs = require("fs");
const { hunkForEdit, lineDiff } = require("../diff-system/diff");
const { resolvePath, requireFolder, readTracker } = require("./shared");

/**
 * Propose overwriting or creating a file. The content is staged in
 * memory and only written when the user approves the diff card.
 * @param {Object} args - { filePath, content }.
 * @param {string} folderPath - The working directory.
 * @param {Object} ctx - { proposeChange, findPending, mergeChange } from the agent loop.
 * @returns {string} The tool result text for the model.
 */
function writeFile({ filePath, content, reason } = {}, folderPath, ctx) {
  requireFolder(folderPath);
  const resolved = resolvePath(filePath, folderPath);

  const exists = fs.existsSync(resolved);
  let hunks;
  if (exists) {
    if (!readTracker.has(resolved)) {
      throw new Error(
        "File has not been read yet. Read it first before overwriting it.",
      );
    }
    const oldContent = fs.readFileSync(resolved, "utf-8");
    hunks = [{ startLine: 1, lines: lineDiff(oldContent, content) }];
  } else {
    hunks = [
      {
        startLine: 1,
        lines: content.split("\n").map((text) => ({ type: "add", text })),
      },
    ];
  }

  const existing = ctx.findPending ? ctx.findPending(resolved) : null;
  if (existing) {
    ctx.mergeChange(existing.id, { hunks, stagedContent: content, reason });
    return `Pending change ${existing.id} for ${filePath} replaced with the new full content. Still queued for user review and NOT written yet.`;
  }

  const stagedMtime = exists ? fs.statSync(resolved).mtimeMs : null;
  const id = ctx.proposeChange({
    filePath: resolved,
    tool: "writeFile",
    hunks,
    stagedContent: content,
    stagedMtime,
    reason,
  });
  return `Change ${id} proposed for ${filePath}. It is queued for user review and NOT written yet. Continue with other work; do not assume it exists on disk.`;
}

/**
 * Propose an exact string replacement in a file. The edit is staged
 * in memory and only written when the user approves the diff card.
 * @param {Object} args - { filePath, oldText, newText, replaceAll }.
 * @param {string} folderPath - The working directory.
 * @param {Object} ctx - { proposeChange, findPending, mergeChange } from the agent loop.
 * @returns {string} The tool result text for the model.
 */
function updateFile({ filePath, oldText, newText, replaceAll, reason } = {}, folderPath, ctx) {
  requireFolder(folderPath);
  const resolved = resolvePath(filePath, folderPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `File does not exist: ${resolved}. Use writeFile to create it.`,
    );
  }
  if (!readTracker.has(resolved)) {
    throw new Error(
      "File has not been read yet. Read it first before updating it.",
    );
  }
  if (!oldText) {
    throw new Error("oldText must not be empty. Use writeFile to set full content.");
  }
  if (oldText === newText) {
    throw new Error("No changes to make: oldText and newText are identical.");
  }

  // A pending change for this file is the new base: the edit applies
  // on top of the staged content so one file holds one proposal.
  const existing = ctx.findPending ? ctx.findPending(resolved) : null;
  const content = existing
    ? existing.stagedContent
    : fs.readFileSync(resolved, "utf-8");

  const matches = content.split(oldText).length - 1;
  if (matches === 0) {
    throw new Error(
      existing
        ? `String to replace not found in ${resolved}. The file has a pending change; base oldText on the staged content or use writeFile.`
        : `String to replace not found in ${resolved}.`,
    );
  }
  if (matches > 1 && !replaceAll) {
    throw new Error(
      `Found ${matches} matches of oldText. Provide more context to make it unique, or set replaceAll to true.`,
    );
  }

  const updated = replaceAll
    ? content.split(oldText).join(newText)
    : content.replace(oldText, () => newText);

  const matchIndices = [];
  let idx = -1;
  while ((idx = content.indexOf(oldText, idx + 1)) !== -1) {
    matchIndices.push(idx);
  }
  const hunks = matchIndices
    .slice(0, 20)
    .map((i) => hunkForEdit(content, i, oldText, newText));

  if (existing) {
    ctx.mergeChange(existing.id, {
      hunks: [...existing.hunks, ...hunks],
      stagedContent: updated,
      reason,
    });
    return `Edits merged into pending change ${existing.id} for ${filePath}. Still queued for user review and NOT written yet.`;
  }

  const stagedMtime = fs.statSync(resolved).mtimeMs;
  const id = ctx.proposeChange({
    filePath: resolved,
    tool: "updateFile",
    hunks,
    stagedContent: updated,
    stagedMtime,
    reason,
  });
  return `Change ${id} proposed for ${filePath}. It is queued for user review and NOT written yet. Continue with other work; do not assume it exists on disk.`;
}

const definitions = [
  {
    type: "function",
    function: {
      name: "updateFile",
      description:
        "Propose an exact string replacement in a file. The change is shown to the user for approval and only written if approved. The file must be read with readFile first. oldText must match exactly once unless replaceAll is true. Multiple updates to the same file merge into one pending change.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to update.",
          },
          oldText: {
            type: "string",
            description: "The exact text to replace.",
          },
          newText: {
            type: "string",
            description: "The replacement text.",
          },
          replaceAll: {
            type: "boolean",
            description:
              "Replace every occurrence of oldText. Default false.",
          },
          reason: {
            type: "string",
            description:
              "One sentence for the user explaining what this change does and why. Shown on the diff card.",
          },
        },
        required: ["filePath", "oldText", "newText", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "writeFile",
      description:
        "Propose creating a new file or overwriting an existing file with the given content. Shown to the user for approval before writing. Overwriting an existing file requires reading it with readFile first.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to write.",
          },
          content: {
            type: "string",
            description: "The full content to write.",
          },
          reason: {
            type: "string",
            description:
              "One sentence for the user explaining what this change does and why. Shown on the diff card.",
          },
        },
        required: ["filePath", "content", "reason"],
      },
    },
  },
];

module.exports = { updateFile, writeFile, definitions };
