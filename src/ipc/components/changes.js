/**
 * IPC handler for pending change decisions.
 * The renderer sends { id, approved } when the user clicks
 * Approve or Reject on a diff card. The result status is sent
 * back over agent:change:status so the card updates.
 */
const pendingChanges = require("../../diff-system/pendingChanges");
const agent = require("./agent");

/**
 * Build the note the session hears after a decision.
 * Exported so the wording can be tested without IPC.
 * @param {string} id - The change id.
 * @param {{status: string, filePath?: string}} result - The decide result.
 * @param {number} remaining - Changes still pending.
 * @returns {string} The [system] note text.
 */
function decisionNote(id, result, remaining) {
  let text = `[system] Change ${id} for ${result.filePath || "a file"} was ${result.status}. `;
  text +=
    remaining === 0
      ? "No changes remain pending."
      : `${remaining} change(s) still pending review.`;
  // The disk changed, so the model can verify its work now. Only nag
  // once the whole batch is decided.
  if (result.status === "applied" && remaining === 0) {
    text +=
      " The edits are on disk. Verify them with the project's test or lint command when one exists, then mark the plan step done.";
  }
  return text;
}

module.exports = {
  name: "change:decide",
  decisionNote,
  handler: (event, { id, approved }) => {
    const result = pendingChanges.decide(id, approved);
    if (event.sender && event.sender.send && result.status) {
      event.sender.send("agent:change:status", { id, status: result.status });
    }
    // Tell the session so the model's next turn knows the change is
    // no longer pending — its earlier tool result said "NOT written yet".
    if (result.status) {
      agent.note(decisionNote(id, result, pendingChanges.count()));
    }
    return result;
  },
};
