/**
 * Preload bridge between the renderer and the main process.
 *
 * Runs before the Vue app loads. Exposes a safe `window.api` object
 * so the renderer can call IPC channels without direct access to
 * Electron internals.
 *
 * Exposed methods:
 *   - chat(message, model, folderPath)   Send a chat request to the AI.
 *   - onThinking(callback)               Subscribe to live thinking updates.
 *   - onToolCall(callback)               Subscribe to live tool call updates.
 *   - getModels()                        Get the list of available AI models.
 *   - selectFolder()                     Open the folder picker dialog.
 *   - readFolderContents(path)           Read the contents of a folder.
 *   - interruptChat()                     Interrupt the current chat.
 *   - windowMinimize()                    Minimize the window.
 *   - windowMaximize()                    Maximize or unmaximize the window.
 *   - windowClose()                       Close the window.
 *
 * onThinking and onToolCall return an unsubscribe function. Call it
 * to stop listening when the chat ends.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  chat: (message, model, folderPath, host, apiKey) =>
    ipcRenderer.invoke("agent", {
      message,
      model,
      folderPath,
      host,
      apiKey,
    }),
  onThinking: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on("agent:thinking", listener);
    return () => ipcRenderer.removeListener("agent:thinking", listener);
  },
  onToolCall: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on("agent:tool", listener);
    return () => ipcRenderer.removeListener("agent:tool", listener);
  },
  onChange: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on("agent:change", listener);
    return () => ipcRenderer.removeListener("agent:change", listener);
  },
  onChangeStatus: (callback) => {
    const listener = (_e, data) => callback(data);
    ipcRenderer.on("agent:change:status", listener);
    return () => ipcRenderer.removeListener("agent:change:status", listener);
  },
  decideChange: (id, approved) =>
    ipcRenderer.invoke("change:decide", { id, approved }),
  getModels: (host, apiKey) => ipcRenderer.invoke("get-models", { host, apiKey }),
  selectFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  readFolderContents: (path) => ipcRenderer.invoke("folder:readContents", path),
  interruptChat: () => ipcRenderer.invoke("agent:interrupt"),
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  platform: process.platform,
  testConnection: (host, apiKey) =>
    ipcRenderer.invoke("settings:test", { host, apiKey }),
});
