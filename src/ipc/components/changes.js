/**
 * IPC handler for pending change decisions.
 * The renderer sends { id, approved } when the user clicks
 * Approve or Reject on a diff card. The result status is sent
 * back over agent:change:status so the card updates.
 */
const pendingChanges = require("../../diff-system/pendingChanges");

module.exports = {
  name: "change:decide",
  handler: (event, { id, approved }) => {
    const result = pendingChanges.decide(id, approved);
    if (event.sender && event.sender.send && result.status) {
      event.sender.send("agent:change:status", { id, status: result.status });
    }
    return result;
  },
};
