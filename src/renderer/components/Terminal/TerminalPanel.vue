<template>
  <div class="terminal-panel">
    <div class="terminal-toolbar">
      <div class="terminal-tabs">
        <button
          v-for="id in tabs"
          :key="id"
          class="terminal-tab"
          :class="{ active: id === activeId }"
          @click="switchTab(id)"
        >
          {{ id }}
        </button>
      </div>
      <div class="terminal-actions">
        <button class="terminal-btn" @click="createTab">+</button>
        <button class="terminal-btn" @click="killTab(activeId)" :disabled="!activeId">x</button>
      </div>
    </div>
    <div ref="viewport" class="terminal-viewport"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import "@xterm/xterm/css/xterm.css";
import {
  acquireTerminal,
  attachTerminal,
  writeToTerminal,
  disposeTerminal,
} from "./terminalPool";

// Module scope: survives HMR remounts so ids never repeat.
let panelCounter = 0;

const props = defineProps({
  folderPath: { type: String, default: "" },
  visible: { type: Boolean, default: false },
});

const tabs = ref([]);
const activeId = ref("");
const viewport = ref(null);
let unsubData = null;
let unsubExit = null;
let ro = null;

function nextId() {
  panelCounter += 1;
  return `term-${panelCounter}`;
}

async function createTab() {
  const id = nextId();
  const entry = acquireTerminal(id);
  tabs.value.push(id);
  activeId.value = id;
  await nextTick();
  mountActive(true);
  writeToTerminal(id, `\r\n[connecting ${id}...]\r\n`);
  console.log("[terminal] bridge:", typeof window.api?.terminalCreate);
  if (typeof window.api?.terminalCreate !== "function") {
    writeToTerminal(id, "[terminal bridge missing: restart Electron to load new preload/IPC]\r\n");
    return;
  }
  try {
    const result = await window.api.terminalCreate(id, {
      cwd: props.folderPath || undefined,
      cols: entry.term.cols || 80,
      rows: entry.term.rows || 24,
    });
    console.log("[terminal] create result:", JSON.stringify(result));
    if (!result?.ok) {
      writeToTerminal(id, `[terminal create failed: ${result?.error || "unknown"}]\r\n`);
    }
  } catch (err) {
    writeToTerminal(id, `[terminal create failed: ${err.message}]\r\n`);
  }
}

function switchTab(id) {
  activeId.value = id;
  nextTick(() => mountActive());
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
    nextTick(() => mountActive());
  }
  if (tabs.value.length === 0) createTab();
}

function mountActive(focus = false) {
  if (!viewport.value || !activeId.value) return;
  const entry = acquireTerminal(activeId.value);
  attachTerminal(entry, viewport.value);
  if (focus) {
    try {
      entry.term.focus();
    } catch {
      // Focus is best effort.
    }
  }
}

watch(activeId, () => mountActive());

watch(
  () => props.visible,
  (show) => {
    if (show) nextTick(() => mountActive());
  },
);

onMounted(async () => {
  if (window.api?.onTerminalData) {
    unsubData = window.api.onTerminalData(({ id, data }) => writeToTerminal(id, data));
  }
  if (window.api?.onTerminalExit) {
    unsubExit = window.api.onTerminalExit(({ id, exitCode }) => {
      writeToTerminal(id, `\r\n\u001b[2m─ process exited (code ${exitCode}) ─\u001b[0m\r\n`);
    });
  }
  // Reuse live PTYs after a remount; only spawn when none exist.
  try {
    const list = await window.api?.terminalList?.();
    const ids = list?.ids || [];
    if (ids.length > 0) {
      for (const id of ids) {
        const num = parseInt(String(id).split("-")[1], 10);
        if (Number.isFinite(num) && num > panelCounter) panelCounter = num;
        acquireTerminal(id);
        if (!tabs.value.includes(id)) tabs.value.push(id);
      }
      activeId.value = tabs.value[tabs.value.length - 1];
      await nextTick();
      mountActive(true);
      return;
    }
  } catch {
    // Fall through to fresh tab.
  }
  await createTab();
  mountActive();
  if (viewport.value) {
    ro = new ResizeObserver(() => mountActive());
    ro.observe(viewport.value);
  }
});

onBeforeUnmount(() => {
  if (unsubData) unsubData();
  if (unsubExit) unsubExit();
  if (ro) ro.disconnect();
});

defineExpose({ createTab, killTab, switchTab });
</script>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  background-color: var(--bg-deep);
}

.terminal-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 8px;
  background-color: var(--bg-secondary);
  flex-shrink: 0;
}

.terminal-tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  min-width: 0;
}

.terminal-tab {
  background: none;
  border: 1px solid transparent;
  color: var(--text-secondary);
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}

.terminal-tab.active {
  color: var(--text);
  border-color: var(--border);
}

.terminal-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.terminal-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
}

.terminal-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.terminal-viewport {
  flex: 1;
  min-height: 0;
  min-width: 0;
  padding: 8px;
  overflow: hidden;
}

.terminal-viewport :deep(.golem-xterm-host) {
  height: 100%;
}

.terminal-viewport :deep(.xterm) {
  height: 100%;
  padding: 0;
}
</style>
