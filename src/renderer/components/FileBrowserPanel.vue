<template>
  <div class="side-panel" :class="{ collapsed }">
    <div v-if="collapsed" class="collapsed-strip" @click="$emit('toggleCollapse')" title="Expand browser">
      <span class="collapsed-label">Browser</span>
    </div>
    <template v-else>
    <div class="panel-tabs">
      <div class="panel-tab active" @click="$emit('toggleCollapse')" title="Collapse browser">Browser</div>
      <div
        class="refresh-btn"
        :class="{ disabled: !folderPath }"
        @click="refresh"
        title="Refresh"
      >
        <span class="refresh-icon">&#8635;</span>
      </div>
      <div class="folder-picker" @click="$emit('selectFolder')" :title="folderPath || 'Select folder'">
        <span v-if="folderPath" class="folder-icon" v-html="folderOpenIcon"></span>
        <span v-else class="folder-icon" v-html="folderClosedIcon"></span>
      </div>
    </div>
    <div class="panel-content">
      <div v-if="folderPath" class="tree-root" :title="folderPath">
        <span class="tree-root-icon" v-html="folderOpenIcon"></span>
        <span class="tree-root-name">{{ rootName }}</span>
      </div>
      <div v-if="!folderPath" class="side-panel-empty">
        No folder selected
      </div>
      <div v-else-if="loading" class="side-panel-empty">
        Loading...
      </div>
      <div v-else-if="error" class="side-panel-empty">
        {{ error }}
      </div>
      <div v-else class="folder-entries">
        <FileBrowserEntry
          v-for="entry in entries"
          :key="entry.name"
          :entry="entry"
          :depth="0"
          :basePath="folderPath"
          :selectedFile="selectedFile"
          @select="selectedFile = $event"
          @toggle="toggleEntry"
          @open="$emit('openFile', $event)"
        />
      </div>
    </div>
    <div class="settings-card" @click="settingsOpen = true">
      <span class="settings-icon">&#9881;</span>
      <span class="settings-text">Settings</span>
    </div>
    <SettingsModal
      :open="settingsOpen"
      @close="settingsOpen = false"
      @saved="$emit('settingsSaved')"
    />
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import FileBrowserEntry from "./FileBrowserEntry.vue";
import SettingsModal from "./Settings/SettingsModal.vue";
import folderOpenIcon from "../../icons/folder-open-icon.svg?raw";
import folderClosedIcon from "../../icons/folder-open-closed.svg?raw";

const props = defineProps({
  folderPath: { type: String, default: "" },
  collapsed: { type: Boolean, default: false },
});

defineEmits(["selectFolder", "settingsSaved", "openFile", "toggleCollapse"]);

const entries = ref([]);
const loading = ref(false);

// Basename of the working folder, shown as the tree's root row.
const rootName = computed(() => {
  const parts = props.folderPath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || props.folderPath;
});
const error = ref("");
const selectedFile = ref("");
const settingsOpen = ref(false);

async function loadContents() {
  if (!props.folderPath) {
    entries.value = [];
    return;
  }
  loading.value = true;
  error.value = "";
  selectedFile.value = "";
  try {
    const result = await window.api.readFolderContents(props.folderPath);
    if (result.ok) {
      entries.value = result.entries.map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory,
        expanded: false,
        children: [],
        loaded: false,
      }));
    } else {
      error.value = result.error;
    }
  } catch (err) {
    error.value = err.message;
  }
  loading.value = false;
}

async function toggleEntry({ entry, path }) {
  entry.expanded = !entry.expanded;

  if (entry.expanded && !entry.loaded) {
    try {
      const result = await window.api.readFolderContents(path);
      if (result.ok) {
        entry.children = result.entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory,
          expanded: false,
          children: [],
          loaded: false,
        }));
        entry.loaded = true;
      }
    } catch {
      entry.children = [];
    }
  }
}

function refresh() {
  if (!props.folderPath) return;
  loadContents();
}

defineExpose({ refresh });

watch(() => props.folderPath, loadContents, { immediate: true });
</script>

<style scoped>
.side-panel {
  grid-row: 1;
  grid-column: 1;
  border: 1px solid var(--border);
  background-color: var(--bg);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.panel-tab {
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
}

.panel-tab.active {
  color: var(--text);
}

.collapsed-strip {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8px;
  cursor: pointer;
}

.collapsed-strip:hover {
  background-color: var(--bg-tertiary);
}

.collapsed-label {
  writing-mode: vertical-rl;
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.collapsed-strip:hover .collapsed-label {
  color: var(--text);
}

.refresh-btn {
  margin-left: auto;
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  color: var(--text-secondary);
}

.refresh-btn:hover {
  color: var(--text);
}

.refresh-btn.disabled {
  opacity: 0.4;
  cursor: default;
}

.refresh-icon {
  font-size: 14px;
  line-height: 1;
}

.folder-picker {
  padding: 4px 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.folder-picker:hover .folder-icon {
  opacity: 0.8;
}

.folder-icon :deep(svg) {
  width: 14px;
  height: 14px;
}

.panel-content {
  overflow-y: auto;
  padding: 8px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.side-panel-empty {
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  padding: 16px 4px;
  margin-top: 0;
  margin-bottom: 0;
}

.tree-root {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  padding: 0 4px;
  margin-bottom: 2px;
  flex-shrink: 0;
}

.tree-root-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tree-root-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.tree-root-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

.folder-entries {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-top: 1px solid var(--border);
  cursor: pointer;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 12px;
}

.settings-card:hover {
  background-color: var(--bg-tertiary);
  color: var(--text);
}

.settings-icon {
  font-size: 14px;
}
</style>
