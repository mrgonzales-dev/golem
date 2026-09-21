/**
 * IPC handler registry.
 * Imports all handler modules and registers them with ipcMain.
 * Call registerIpcHandlers() once during app startup.
 */
const { ipcMain } = require("electron");
const agent = require("./components/agent");
const models = require("./components/models");
const dialog = require("./components/dialog");
const folder = require("./components/folder");
const settings = require("./components/settings");
const changes = require("./components/changes");
const file = require("./components/file");
const session = require("../session-system/sessionIpc");
const terminal = require("../terminal-system/terminalIpc");

const handlers = [
  agent,
  models,
  dialog,
  folder,
  settings,
  changes,
  file,
  ...session.handlers,
  ...terminal.handlers,
];

function registerIpcHandlers() {
  for (const { name, handler } of handlers) {
    ipcMain.handle(name, handler);
  }
  ipcMain.handle("agent:interrupt", agent.interrupt);
}

module.exports = { registerIpcHandlers };
