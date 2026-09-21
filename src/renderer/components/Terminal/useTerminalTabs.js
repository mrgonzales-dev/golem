/**
 * useTerminalTabs.js — shared terminal tab state for all panels.
 *
 * Both the chat-slot panel and the side panel use this composable,
 * so one tab list serves both docks. Module-level refs survive
 * unmounts; the xterm pool keeps buffers; subscriptions attach once.
 * Only the engaged (visible) panel mounts the xterm host element.
 */
import { ref, nextTick } from "vue";
import {
  acquireTerminal,
  attachTerminal,
  writeToTerminal,
  disposeTerminal,
} from "./terminalPool";

const tabs = ref([]);
const activeId = ref("");
let subsReady = false;
let initDone = false;
let bootScheduled = false;

function nextId() {
  let n = 1;
  while (tabs.value.includes(`term-${n}`)) {
    n += 1;
  }
  return `term-${n}`;
}

function ensureSubscriptions() {
  if (subsReady) return;
  subsReady = true;
  if (window.api?.onTerminalData) {
    window.api.onTerminalData(({ id, data }) => writeToTerminal(id, data));
  }
  if (window.api?.onTerminalExit) {
    window.api.onTerminalExit(({ id, exitCode }) => {
      writeToTerminal(
        id,
        `\r\n\u001b[2m─ process exited (code ${exitCode}) ─\u001b[0m\r\n`,
      );
    });
  }
}

async function createTab(folderPath) {
  const id = nextId();
  acquireTerminal(id);
  tabs.value.push(id);
  activeId.value = id;
  try {
    if (typeof window.api?.terminalCreate !== "function") {
      writeToTerminal(
        id,
        "\r\n[terminal bridge missing: restart Electron to load new preload/IPC]\r\n",
      );
      return id;
    }
    const entry = acquireTerminal(id);
    const result = await window.api.terminalCreate(id, {
      cwd: folderPath || undefined,
      cols: entry.term.cols || 80,
      rows: entry.term.rows || 24,
    });
    if (!result?.ok) {
      writeToTerminal(
        id,
        `[terminal create failed: ${result?.error || "unknown"}]\r\n`,
      );
    }
  } catch (err) {
    writeToTerminal(id, `[terminal create failed: ${err.message}]\r\n`);
  }
  return id;
}

function switchTab(id) {
  if (!tabs.value.includes(id)) return;
  activeId.value = id;
}

async function killTab(id) {
  if (!id) return;
  try {
    await window.api?.terminalKill?.(id);
  } catch {
    // PTY may lag; still drop the UI.
  }
  disposeTerminal(id);
  tabs.value = tabs.value.filter((t) => t !== id);
  if (activeId.value === id) {
    activeId.value = tabs.value[tabs.value.length - 1] || "";
  }
}

function mountActive(container, focus = false) {
  if (!container || !activeId.value) return;
  const entry = acquireTerminal(activeId.value);
  attachTerminal(entry, container);

  if (focus) {
    try {
      entry.term.focus();
    } catch {
      // Focus is best effort.
    }
  }
}

async function ensureInit(folderPath) {
  ensureSubscriptions();
  if (initDone) return;
  initDone = true;
  try {
    const list = await window.api?.terminalList?.();
    const ids = list?.ids || [];
    for (const id of ids) {
      acquireTerminal(id);
      if (!tabs.value.includes(id)) tabs.value.push(id);
    }
    if (tabs.value.length > 0) {
      activeId.value = tabs.value[tabs.value.length - 1];
      return;
    }
  } catch {
    // Fall through to fresh tab.
  }
  writeBootSoon(folderPath);
}

function writeBootSoon(folderPath) {
  // Defer so the caller can mount the viewport first.
  // Guarded: two panels mount at once, only one boots.
  if (bootScheduled || tabs.value.length > 0) return;
  bootScheduled = true;
  nextTick(async () => {
    const id = await createTab(folderPath);
    void id;
  });
}

function ensureFirstTab(folderPath) {
  writeBootSoon(folderPath);
}

export function useTerminalTabs() {
  return {
    tabs,
    activeId,
    createTab,
    switchTab,
    killTab,
    mountActive,
    ensureInit,
    ensureFirstTab,
  };
}
