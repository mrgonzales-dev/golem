/**
 * Session IPC handlers.
 *
 * The renderer owns display state (messages, folder, model); the
 * main process owns the real conversation (AgentSession.history)
 * and pending diffs. session:save merges both layers into one file;
 * session:latest reads the newest file and hydrates both layers.
 *
 * Handlers are exported as an array so ipc/index.js can spread them
 * into its registry — and so future channels (picker, rename) slot
 * in without touching the registry again.
 */
const sessionStore = require("./sessionStore");
const agent = require("../ipc/components/agent");
const pendingChanges = require("../diff-system/pendingChanges");

const handlers = [
  {
    name: "session:save",
    handler: (_event, payload) => {
      const snap = agent.snapshot();
      return sessionStore.saveSession({
        id: snap.sessionId,
        title: payload.title,
        folderPath: payload.folderPath,
        selectedModel: payload.selectedModel,
        thinkingEffort: payload.thinkingEffort,
        messages: payload.messages || [],
        history: snap.history,
        lastFolderPath: snap.lastFolderPath,
        pendingChanges: pendingChanges.serialize(),
      });
    },
  },
  {
    name: "session:latest",
    handler: () => {
      const session = sessionStore.loadLatestSession();
      if (!session) return { ok: true, session: null };
      agent.restore(session);
      pendingChanges.restore(session.pendingChanges || []);
      return {
        ok: true,
        session: {
          id: session.id,
          title: session.title,
          folderPath: session.folderPath || "",
          selectedModel: session.selectedModel || "",
          thinkingEffort: session.thinkingEffort || "off",
          messages: session.messages || [],
          // Same card shape the live agent:change event emits.
          pendingChanges: (session.pendingChanges || []).map(
            ({ stagedContent, stagedMtime, ...card }) => ({
              status: "pending",
              ...card,
            }),
          ),
        },
      };
    },
  },
  {
    name: "session:list",
    handler: () => sessionStore.listSessions(),
  },
  {
    name: "session:new",
    handler: () => {
      agent.clearHistory();
      pendingChanges.rejectAll();
      return { ok: true, sessionId: agent.snapshot().sessionId };
    },
  },
  {
    name: "session:delete",
    handler: (_event, id) => ({ ok: sessionStore.deleteSession(id) }),
  },
];

module.exports = { handlers };
