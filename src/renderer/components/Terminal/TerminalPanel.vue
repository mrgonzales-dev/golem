<template>
  <div class="terminal-panel">
    <div class="terminal-toolbar">
      <div class="terminal-tabs">
        <button
          v-for="id in tabs"
          :key="id"
          class="terminal-tab"
          :class="{ active: id === activeId }"
          @click="onSwitch(id)"
        >
          {{ id }}<em @click.stop="onKill(id)" title="Kill terminal">x</em>
        </button>
      </div>
      <div class="terminal-actions">
        <button
          class="terminal-btn"
          :class="{ active: dock === 'side' }"
          :title="dock === 'side' ? 'Move terminal to chat' : 'Move terminal to side panel'"
          @click="$emit('toggleDock')"
        >◫</button>
        <button class="terminal-btn" title="New terminal" @click="onCreate">+</button>
        <button class="terminal-btn" title="Close terminal" @click="$emit('close')">x</button>
      </div>
    </div>
    <div ref="viewport" class="terminal-viewport"></div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import "@xterm/xterm/css/xterm.css";
import { useTerminalTabs } from "./useTerminalTabs";

const props = defineProps({
  folderPath: { type: String, default: "" },
  visible: { type: Boolean, default: false },
  // True only for the panel that currently owns the viewport.
  engaged: { type: Boolean, default: false },
  dock: { type: String, default: "chat" },
});

defineEmits(["toggleDock", "close"]);

const { tabs, activeId, createTab, switchTab, killTab, mountActive, ensureInit, ensureFirstTab } =
  useTerminalTabs();

const viewport = ref(null);
let ro = null;

function mount(focus = false) {
  if (!props.engaged) return;
  mountActive(viewport.value, focus);
}

async function onCreate() {
  await createTab(props.folderPath);

  await nextTick();
  mount(true);
}

function onSwitch(id) {
  switchTab(id);
  nextTick(() => mount(true));
}

async function onKill(id) {
  if (!id) return;
  await killTab(id);
  await nextTick();
  mount(true);
  if (tabs.value.length === 0) onCreate();
}

watch(activeId, () => mount());

watch(
  () => props.engaged,
  (on) => {
    if (on) {
      nextTick(() => mount(true));
      ensureFirstTab(props.folderPath);
    }
  },
);

watch(
  () => props.visible,
  (show) => {
    if (show) nextTick(() => mount());
  },
);

onMounted(async () => {
  await ensureInit(props.folderPath);
  await nextTick();
  mount();
  if (viewport.value) {
    ro = new ResizeObserver(() => mount());
    ro.observe(viewport.value);
  }
  if (props.engaged) ensureFirstTab(props.folderPath);
});

onBeforeUnmount(() => {
  if (ro) ro.disconnect();
});
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

.terminal-tab em {
  font-style: normal;
  margin-left: 6px;
  padding: 0 2px;
  color: var(--text-secondary);
}

.terminal-tab em:hover {
  color: var(--text);
}

.terminal-tab.active em {
  color: var(--text-secondary);
}

.terminal-tab.active em:hover {
  color: var(--text);
}

.terminal-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.terminal-btn {
  background: none;
  border: none;
  color: var(--text-secondary);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  font-size: 13px;
}

.terminal-btn:hover {
  color: var(--text);
}

.terminal-btn.active {
  color: var(--text);
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
