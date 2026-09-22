/**
 * Session IPC handlers.
 *
 * The renderer owns display state (messages, folder, model); the
 * main process owns the real conversation (AgentSession.history),
 * the task plan, the read tracker, and pending diffs. session:save
 * merges all layers into one file; session:latest reads the newest
 * file and hydrates every layer.
 *
 * Handlers are exported as an array so ipc/index.js can spread them
 * into its registry — and so future channels (picker, rename) slot
 * in without touching the registry again.
 */
const sessionStore = require("./sessionStore");
const agent = require("../ipc/components/agent");
const pendingChanges = require("../diff-system/pendingChanges");
const { serializeReads, restoreReads, readsFromHistory } = require("../tools");

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
        plan: snap.plan,
        reads: serializeReads(),
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
      // Older session files predate the reads snapshot. Rebuild the
      // tracker from the readFile calls in the history so updateFile
      // does not contradict what the model remembers.
      restoreReads(
        Array.isArray(session.reads)
          ? session.reads
          : readsFromHistory(session.history, session.lastFolderPath || session.folderPath),
      );
      return {
        ok: true,
        session: {
          id: session.id,
          title: session.title,
          folderPath: session.folderPath || "",
          selectedModel: session.selectedModel || "",
          thinkingEffort: session.thinkingEffort || "default",
          messages: session.messages || [],
          plan: Array.isArray(session.plan) ? session.plan : [],
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
      restoreReads([]);
      return { ok: true, sessionId: agent.snapshot().sessionId };
    },
  },
  {
    name: "session:delete",
    handler: (_event, id) => ({ ok: sessionStore.deleteSession(id) }),
  },
  {
    name: "agent:plan:clear",
    handler: () => {
      agent.clearPlan();
      return { ok: true };
    },
  },
];

module.exports = { handlers };
