/**
 * ptyManager.js — tracks live PTY sessions by id.
 *
 * Wraps node-pty spawn with create/write/resize/kill/list
 * plus onData/onExit fan-out. Accepts a fake spawn in tests
 * so the suite runs with no native module. One manager lives
 * in terminalIpc.js for the whole app.
 */
const { buildPtyOptions } = require("./terminalConfig");
const { resolveShellConfig } = require("./shellResolve");

function createPtyManager({ spawn } = {}) {
  const sessions = new Map();
  // Lazy require keeps unit tests free of the native module.
  // Real use injects node-pty spawn or lets this load it.
  let realSpawn = spawn || null;

  function loadSpawn() {
    if (realSpawn) return realSpawn;
    realSpawn = require("node-pty").spawn;
    return realSpawn;
  }

  function create(id, opts = {}) {
    if (!id) throw new Error("Terminal id must not be empty.");
    if (sessions.has(id)) throw new Error(`Terminal ${id} already exists.`);
    const spawnFn = opts.spawn || loadSpawn();
    const { shell, args } = resolveShellConfig({
      shell: opts.shell,
      args: opts.args,
      platform: opts.platform,
    });
    const ptyOpts = buildPtyOptions({
      cwd: opts.cwd,
      cols: opts.cols,
      rows: opts.rows,
      shellName: opts.shellName,
      env: opts.env,
    });
    const pty = spawnFn(shell, args, ptyOpts);
    const session = {
      id,
      pty,
      cwd: ptyOpts.cwd,
      dataHandlers: new Set(),
      exitHandlers: new Set(),
    };
    if (pty.onData) {
      pty.onData((data) => {
        for (const fn of session.dataHandlers) fn(data);
      });
    }
    if (pty.onExit) {
      pty.onExit((evt) => {
        for (const fn of session.exitHandlers) fn(evt);
      });
    }
    sessions.set(id, session);
    return session;
  }

  function requireSession(id) {
    const s = sessions.get(id);
    if (!s) throw new Error(`Unknown terminal: ${id}.`);
    return s;
  }

  function write(id, data) {
    requireSession(id).pty.write(data);
  }

  function resize(id, cols, rows) {
    const s = requireSession(id);
    const { sanitizeDims } = require("./terminalConfig");
    const dims = sanitizeDims(cols, rows);
    s.pty.resize(dims.cols, dims.rows);
    return dims;
  }

  function kill(id) {
    const s = requireSession(id);
    sessions.delete(id);
    if (s.pty.kill) s.pty.kill();
  }

  function killAll() {
    for (const id of [...sessions.keys()]) kill(id);
  }

  function get(id) {
    return sessions.get(id) || null;
  }

  function list() {
    return [...sessions.keys()];
  }

  function onData(id, fn) {
    const s = requireSession(id);
    s.dataHandlers.add(fn);
    return () => s.dataHandlers.delete(fn);
  }

  function onExit(id, fn) {
    const s = requireSession(id);
    s.exitHandlers.add(fn);
    return () => s.exitHandlers.delete(fn);
  }

  // Test hook: push fake output through the data path.
  function emitForTest(id, data) {
    const s = requireSession(id);
    for (const fn of s.dataHandlers) fn(data);
  }

  return { create, write, resize, kill, killAll, get, list, onData, onExit, emitForTest };
}

module.exports = { createPtyManager };
