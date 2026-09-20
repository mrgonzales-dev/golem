/**
 * IPC handler for pending change decisions.
 * The renderer sends { id, approved } when the user clicks
 * Approve or Reject on a diff card. The result status is sent
 * back over agent:change:status so the card updates.
 */
const pendingChanges = require("../../diff-system/pendingChanges");
const agent = require("./agent");

module.exports = {
  name: "change:decide",
  handler: (event, { id, approved }) => {
    const result = pendingChanges.decide(id, approved);
    if (event.sender && event.sender.send && result.status) {
      event.sender.send("agent:change:status", { id, status: result.status });
    }
    // Tell the session so the model's next turn knows the change is
    // no longer pending — its earlier tool result said "NOT written yet".
    if (result.status) {
      const remaining = pendingChanges.count();
      agent.note(
        `[system] Change ${id} for ${result.filePath || "a file"} was ${result.status}. ` +
          (remaining === 0
            ? "No changes remain pending."
            : `${remaining} change(s) still pending review.`),
      );
    }
    return result;
  },
};
