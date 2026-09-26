/**
 * terminalIpc.js — main-process bridge for the terminal.
 *
 * Registers terminal:create/write/resize/kill/list on ipcMain
 * and streams PTY output back as terminal:data / terminal:exit.
 * Uses one shared ptyManager. Guards sends when the window dies.
 * Renderer reaches it via the window.api.terminal* preload calls.
 */
const { createPtyManager } = require("./ptyManager");

const manager = createPtyManager();

function safeSend(sender, channel, payload) {
  try {
    if (!sender || sender.isDestroyed()) return;
    sender.send(channel, payload);
  } catch {
    // Window tore down; drop the chunk.
  }
}

function attachStream(event, id) {
  manager.onData(id, (data) => safeSend(event.sender, "terminal:data", { id, data }));
  manager.onExit(id, (evt) =>
    safeSend(event.sender, "terminal:exit", {
      id,
      exitCode: evt.exitCode,
      signal: evt.signal,
    }),
  );
}

const handlers = [
  {
    name: "terminal:create",
    handler: (event, { id, cwd, cols, rows, shell } = {}) => {
      try {
        manager.create(id, { cwd, cols, rows, shell });
        attachStream(event, id);
        return { ok: true, id };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  },
  {
    name: "terminal:write",
    handler: (_event, { id, data } = {}) => {
      try {
        manager.write(id, data);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  },
  {
    name: "terminal:resize",
    handler: (_event, { id, cols, rows } = {}) => {
      try {
        const dims = manager.resize(id, cols, rows);
        return { ok: true, ...dims };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  },
  {
    name: "terminal:kill",
    handler: (_event, { id } = {}) => {
      try {
        manager.kill(id);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    },
  },
  {
    name: "terminal:list",
    handler: () => ({ ok: true, ids: manager.list() }),
  },
];

module.exports = { handlers };
