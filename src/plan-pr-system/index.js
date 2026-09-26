/**
 * Pull request system entry point.
 * One shared registry for the whole app, used by the agent tool
 * context, the IPC handlers, and session persistence.
 */
const { createPrStore } = require("./prStore");

const prStore = createPrStore();

module.exports = { prStore, createPrStore };
