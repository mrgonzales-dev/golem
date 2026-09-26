/**
 * Pull request IPC handlers.
 * pr:list feeds the page, pr:remove deletes, pr:status moves a pull
 * request between open/implemented/closed. Implement and Send to
 * Agent are plain chat messages on the renderer side — no channels.
 */
const { prStore } = require("./index");

const handlers = [
  {
    name: "pr:list",
    handler: () => ({ ok: true, prs: prStore.list() }),
  },
  {
    name: "pr:remove",
    handler: (_event, id) => ({ ok: prStore.remove(id) }),
  },
  {
    name: "pr:status",
    handler: (_event, { id, status } = {}) => ({
      ok: prStore.setStatus(id, status),
    }),
  },
];

module.exports = { handlers };
