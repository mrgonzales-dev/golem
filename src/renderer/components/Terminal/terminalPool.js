import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { golemTheme, golemFont } from "./terminalTheme";

const pool = new Map();

export function acquireTerminal(ptyId) {
  const existing = pool.get(ptyId);
  if (existing) return existing;
  const host = document.createElement("div");
  host.className = "golem-xterm-host";
  const term = new Terminal({ ...golemFont, theme: golemTheme });
  const fit = new FitAddon();
  term.loadAddon(fit);
  term.loadAddon(new WebLinksAddon());
  term.onData((data) => window.api?.terminalWrite?.(ptyId, data));
  const entry = { term, fit, host, opened: false, ptyId };
  pool.set(ptyId, entry);
  return entry;
}

export function attachTerminal(entry, container) {
  if (!container || !entry) return;
  if (entry.host.parentElement !== container) container.appendChild(entry.host);
  if (!entry.opened) {
    entry.term.open(entry.host);
    entry.opened = true;
  }
  requestAnimationFrame(() => {
    try {
      entry.fit.fit();
      window.api?.terminalResize?.(entry.ptyId, entry.term.cols, entry.term.rows);
    } catch {
      // Container hidden; fit on next show.
    }
  });
}

export function fitTerminal(ptyId) {
  const entry = pool.get(ptyId);
  if (!entry || !entry.opened) return;
  entry.fit.fit();
  window.api?.terminalResize?.(ptyId, entry.term.cols, entry.term.rows);
}

export function writeToTerminal(ptyId, data) {
  pool.get(ptyId)?.term.write(data);
}

export function disposeTerminal(ptyId) {
  const entry = pool.get(ptyId);
  if (!entry) return;
  try {
    entry.term.dispose();
  } catch {
    // Already gone.
  }
  entry.host.remove();
  pool.delete(ptyId);
}

export function poolSize() {
  return pool.size;
}
