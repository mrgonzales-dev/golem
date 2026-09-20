<template>
  <div class="app-shell">
    <TitleBar
      :browserVisible="browserVisible"
      @openSettings="settingsOpen = true"
      @toggleBrowser="browserVisible = !browserVisible"
    />
    <div class="parent" :class="{ resizing: resizing }" :style="parentStyle">
      <FileBrowserPanel v-if="browserVisible" ref="fileBrowser" :folderPath="folderPath" @selectFolder="selectFolder" @settingsSaved="loadModels" @openFile="viewingFile = $event" @toggleBrowser="browserVisible = false" />
      <div
        v-if="browserVisible"
        class="pane-resizer"
        :class="{ active: resizing === 'browser' }"
        @mousedown.prevent="startResize('browser', $event)"
      ></div>
      <AgentInstanceCard
        ref="agentCard"
        :models="models"
        :modelContextMap="modelContextMap"
        :modelMetaMap="modelMetaMap"
        :folderPath="folderPath"
        v-model:diffOpen="diffOpen"
        v-model:pendingChanges="pendingChanges"
        v-model:viewingFile="viewingFile"
        @openSettings="settingsOpen = true"
        @decideAll="handleDecideAll"
      />
    </div>
    <SettingsModal
      :open="settingsOpen"
      @close="settingsOpen = false"
      @saved="loadModels"
    />
  </div>
</template>

<script setup>

import {ref, computed, watch, onMounted, onBeforeUnmount} from "vue";
import "./style.css";
import FileBrowserPanel from "./components/FileBrowserPanel.vue";
import TitleBar from "./components/TitleBar.vue";
import SettingsModal from "./components/Settings/SettingsModal.vue";
import AgentInstanceCard from "./components/AgentInstance/AgentInstanceCard.vue";
import { getProviderConfig, hasProviderConfig } from "./components/Settings/partials/providerConfig";
import { loadAppState, saveAppState } from "./partials/appState";

const models = ref([]);
const modelContextMap = ref({});
const modelMetaMap = ref({});
const folderPath = ref("");
const viewingFile = ref("");
const diffOpen = ref(false);
const pendingChanges = ref([]);
const agentCard = ref(null);
const fileBrowser = ref(null);
const settingsOpen = ref(false);

const browserWidth = ref(200);
const browserVisible = ref(false);
const resizing = ref(null);
let resizeStartX = 0;
let resizeStartWidth = 0;

const BROWSER_MIN = 140;
const BROWSER_MAX = 480;
const AGENT_MIN = 280;

const parentStyle = computed(() => ({
  gridTemplateColumns: browserVisible.value
    ? `${browserWidth.value}px 8px minmax(0, 1fr)`
    : `minmax(0, 1fr)`,
}));

function startResize(pane, event) {
  if (pane === "browser" && !browserVisible.value) return;
  resizing.value = pane;
  resizeStartX = event.clientX;
  resizeStartWidth = browserWidth.value;
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", stopResize);
}

function onResizeMove(event) {
  if (!resizing.value) return;
  const delta = event.clientX - resizeStartX;
  if (resizing.value === "browser") {
    browserWidth.value = Math.min(
      Math.max(resizeStartWidth + delta, BROWSER_MIN),
      BROWSER_MAX,
      window.innerWidth - 16 - AGENT_MIN,
    );
  }
}

function stopResize() {
  resizing.value = null;
  window.removeEventListener("mousemove", onResizeMove);
  window.removeEventListener("mouseup", stopResize);
}

async function loadModels() {
  if (!window.api) return;
  if (!hasProviderConfig()) return;
  const { host, apiKey } = getProviderConfig();
  try {
    const result = await window.api.getModels(host, apiKey);
    if (result.ok) {
      models.value = result.models;
      modelContextMap.value = result.contextMap || {};
      modelMetaMap.value = result.metaMap || {};
    } else {
      console.error("Failed to load models:", result.error);
    }
  } catch (err) {
    console.error("Failed to load models:", err.message);
  }
}

async function selectFolder() {
  if (!window.api) return;
  const result = await window.api.selectFolder();
  if (result.ok) {
    folderPath.value = result.path;
  } else {
    console.error("Folder selection failed:", result.error);
  }
}

async function handleDecide(id, approved, quiet) {
  if (!window.api?.decideChange) return;
  const file =
    pendingChanges.value.find((c) => c.id === id)?.filePath || "the file";
  const result = await window.api.decideChange(id, approved);
  const status = result?.status || (approved ? "applied" : "rejected");
  if (status === "applied") {
    pendingChanges.value = pendingChanges.value.filter((c) => c.id !== id);
    fileBrowser.value?.refresh?.();
  } else {
    pendingChanges.value = pendingChanges.value.map((c) =>
      c.id === id ? { ...c, status } : c,
    );
  }
  if (!quiet) {
    const left = pendingChanges.value.filter(
      (c) => c.status === "pending",
    ).length;
    agentCard.value?.pushNotice?.(
      `Change ${id} ${status} (${file}). ` +
        (left ? `${left} change(s) still pending.` : "No changes pending."),
    );
  }
  if (status === "stale") {
    agentCard.value?.sendSystemMessage?.(
      `Change ${id} for ${file} was not applied: the file changed on disk since the proposal. Re-read it with readFile and propose the change again.`,
    );
  }
}

async function handleDecideAll(approved) {
  const pending = pendingChanges.value.filter((c) => c.status === "pending");
  for (const change of pending) {
    await handleDecide(change.id, approved, true);
  }
  if (approved) diffOpen.value = false;
  const left = pendingChanges.value.filter(
    (c) => c.status === "pending",
  ).length;
  agentCard.value?.pushNotice?.(
    `${pending.length} change(s) ${approved ? "approved" : "rejected"}. ` +
      (left ? `${left} still pending.` : "No changes pending."),
  );
}

watch([folderPath, viewingFile, browserVisible, browserWidth], () => {
  saveAppState({
    folderPath: folderPath.value,
    viewingFile: viewingFile.value,
    browserVisible: browserVisible.value,
    browserWidth: browserWidth.value,
  });
});

onMounted(async () => {
  const saved = loadAppState();
  folderPath.value = saved.folderPath;
  viewingFile.value = saved.viewingFile;
  browserVisible.value = saved.browserVisible;
  browserWidth.value = Math.min(
    Math.max(saved.browserWidth, BROWSER_MIN),
    BROWSER_MAX,
  );
  loadModels();
  if (window.api?.loadLatestSession) {
    try {
      const result = await window.api.loadLatestSession();
      if (result.ok && result.session) {
        const s = result.session;
        if (s.folderPath) folderPath.value = s.folderPath;
        pendingChanges.value = s.pendingChanges || [];
        agentCard.value?.restoreSession?.(s);
      }
    } catch (err) {
      console.error("Session restore failed:", err.message);
    }
  }
});

onBeforeUnmount(stopResize);
</script>
