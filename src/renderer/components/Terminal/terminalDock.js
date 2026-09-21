/**
 * terminalDock.js — remembers where the terminal lives.
 *
 * Two modes exist: "chat" shows the terminal in the chat slot,
 * "side" shows it in a right pane next to the agent card.
 * All helpers are pure and take an injected storage object,
 * so unit tests run with a fake store and no browser APIs.
 */
export const DOCK_CHAT = "chat";
export const DOCK_SIDE = "side";

const KEY = "terminalDock";

export function normalizeDock(value) {
  return value === DOCK_SIDE ? DOCK_SIDE : DOCK_CHAT;
}

export function toggleDockMode(mode) {
  return normalizeDock(mode) === DOCK_SIDE ? DOCK_CHAT : DOCK_SIDE;
}

export function loadDockMode(storage) {
  try {
    return normalizeDock(storage?.getItem(KEY));
  } catch {
    return DOCK_CHAT;
  }
}

export function saveDockMode(storage, mode) {
  const next = normalizeDock(mode);
  try {
    storage?.setItem(KEY, next);
  } catch {
    // Private mode or blocked storage; keep memory value only.
  }
  return next;
}
