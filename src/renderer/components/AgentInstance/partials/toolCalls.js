/**
 * Tool call grouping logic.
 *
 * Groups consecutive tool calls of the same type into a single message
 * entry so the UI can render one "Read" header with a list of files
 * underneath, instead of one row per file.
 *
 * All functions are pure: they do not mutate their inputs.
 */

/**
 * Map a tool name to a short display label.
 * @param {string} toolName - The tool function name.
 * @returns {string} The display label.
 */
export function toolLabel(toolName) {
  const labels = {
    readFile: "Read",
    fileSearch: "Search",
    fileGrep: "Grep",
    listDirectory: "List",
    invokeSkill: "Skill",
    updateFile: "Update",
    writeFile: "Write",
    runCommand: "Run",
  };
  return labels[toolName] || toolName;
}

/**
 * Format a tool's args into a single display string.
 * @param {string} toolName - The tool function name.
 * @param {Object} args - The tool call arguments.
 * @returns {string} The formatted arg string.
 */
export function formatToolArgs(toolName, args) {
  switch (toolName) {
    case "readFile": {
      const range =
        args.startLine || args.endLine
          ? `:${args.startLine || 1}-${args.endLine || "end"}`
          : "";
      return `${args.filePath || ""}${range}`;
    }
    case "fileSearch":
      return `"${args.query}" in ${args.basePath}`;
    case "fileGrep":
      return `"${args.query}" in ${args.basePath}`;
    case "listDirectory":
      return args.dirPath || "working directory";
    case "updateFile":
    case "writeFile":
      return args.filePath || "";
    case "invokeSkill":
      return args.skillName || "list";
    case "runCommand":
      return `$ ${args.command || ""}`;
    default:
      return JSON.stringify(args);
  }
}

/**
 * Compute the aggregate status of a group from its items.
 * Running takes priority over error, error takes priority over done.
 * @param {Array<{status: string}>} items - The group items.
 * @returns {string} "running", "error", or "done".
 */
export function aggregateStatus(items) {
  if (items.length === 0) return "done";
  if (items.some((i) => i.status === "running")) return "running";
  if (items.some((i) => i.status === "error")) return "error";
  return "done";
}

/**
 * Apply a tool call event to the messages array.
 *
 * If the last tool message is the same tool type, the call is added
 * to that group (or updates an existing item by callId). Otherwise a
 * new group is inserted before the thinking message.
 *
 * Does not mutate the input array. Returns a new array and the
 * possibly-shifted thinkingId.
 *
 * @param {Array} messages - The current messages array.
 * @param {number} thinkingId - The index of the thinking message.
 * @param {Object} data - The tool call event: { tool, args, status, callId }.
 * @returns {{messages: Array, thinkingId: number}} The new state.
 */
export function applyToolCall(messages, thinkingId, data) {
  const { tool, args, status, callId } = data;
  const result = messages.map((m) => ({ ...m }));
  let newThinkingId = thinkingId;

  // Find the last tool message before the thinking message.
  let lastToolIndex = -1;
  for (let i = newThinkingId - 1; i >= 0; i--) {
    if (result[i].sender === "Tool") {
      lastToolIndex = i;
      break;
    }
    // Stop at any non-tool message (e.g. AI reply, user message).
    break;
  }

  // Try to add to an existing group of the same tool type.
  if (lastToolIndex >= 0 && result[lastToolIndex].tool === tool) {
    const group = result[lastToolIndex];
    const items = group.items.map((i) => ({ ...i }));
    const existing = items.findIndex((i) => i.callId === callId);

    if (existing >= 0) {
      items[existing] = { ...items[existing], status };
    } else {
      items.push({ args, status, callId });
    }

    result[lastToolIndex] = { ...group, items };
    return { messages: result, thinkingId: newThinkingId };
  }

  // Create a new group inserted before the thinking message.
  const newGroup = {
    sender: "Tool",
    tool,
    items: [{ args, status, callId }],
  };
  result.splice(newThinkingId, 0, newGroup);
  newThinkingId++;

  return { messages: result, thinkingId: newThinkingId };
}
