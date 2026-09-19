<template>
  <div class="app-shell">
    <TitleBar />
    <div class="parent" :class="{ resizing: resizing }" :style="parentStyle">
      <FileBrowserPanel ref="fileBrowser" :folderPath="folderPath" :collapsed="browserCollapsed" @toggleCollapse="browserCollapsed = !browserCollapsed" @selectFolder="selectFolder" @settingsSaved="loadModels" @openFile="viewingFile = $event" />
      <div
        class="pane-resizer"
        :class="{ active: resizing === 'browser' }"
        @mousedown.prevent="startResize('browser', $event)"
      ></div>
      <CodeViewer
        v-if="viewingFile"
        :filePath="viewingFile"
        @close="viewingFile = ''"
      />
      <div
        v-if="viewingFile"
        class="pane-resizer"
        :class="{ active: resizing === 'agent' }"
        @mousedown.prevent="startResize('agent', $event)"
      ></div>
      <AgentInstanceCard
        ref="agentCard"
        :style="{ gridColumn: viewingFile ? 5 : 3 }"
        :models="models"
        :modelContextMap="modelContextMap"
        :folderPath="folderPath"
        v-model:diffOpen="diffOpen"
        v-model:pendingChanges="pendingChanges"
        @decideAll="handleDecideAll"
      />
    </div>
  </div>
</template>

<script setup>

import {ref, computed, onMounted, onBeforeUnmount} from "vue";
import "./style.css";
import FileBrowserPanel from "./components/FileBrowserPanel.vue";
import TitleBar from "./components/TitleBar.vue";
import CodeViewer from "./components/FilePane/CodeViewer.vue";
import AgentInstanceCard from "./components/AgentInstance/AgentInstanceCard.vue";
import { getProviderConfig, hasProviderConfig } from "./components/Settings/partials/providerConfig";

const models = ref([]);
const modelContextMap = ref({});
const folderPath = ref("");
const viewingFile = ref("");
const diffOpen = ref(false);
const pendingChanges = ref([]);
const agentCard = ref(null);
const fileBrowser = ref(null);

const browserWidth = ref(200);
const browserCollapsed = ref(false);
const agentWidth = ref(380);
const resizing = ref(null);
let resizeStartX = 0;
let resizeStartWidth = 0;

const BROWSER_MIN = 140;
const BROWSER_MAX = 480;
const AGENT_MIN = 280;
const AGENT_MAX = 900;
const VIEWER_MIN = 280;
const BROWSER_COLLAPSED = 36;

const effectiveBrowserWidth = computed(() =>
  browserCollapsed.value ? BROWSER_COLLAPSED : browserWidth.value,
);

const parentStyle = computed(() => ({
  gridTemplateColumns: viewingFile.value
    ? `${effectiveBrowserWidth.value}px 8px minmax(${VIEWER_MIN}px, 1fr) 8px ${agentWidth.value}px`
    : `${effectiveBrowserWidth.value}px 8px minmax(0, 1fr)`,
}));

function startResize(pane, event) {
  if (pane === "browser" && browserCollapsed.value) return;
  resizing.value = pane;
  resizeStartX = event.clientX;
  resizeStartWidth = pane === "browser" ? browserWidth.value : agentWidth.value;
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", stopResize);
}

function onResizeMove(event) {
  if (!resizing.value) return;
  const delta = event.clientX - resizeStartX;
  if (resizing.value === "browser") {
    const roomNeeded = viewingFile.value
      ? 16 + VIEWER_MIN + AGENT_MIN
      : AGENT_MIN;
    browserWidth.value = Math.min(
      Math.max(resizeStartWidth + delta, BROWSER_MIN),
      BROWSER_MAX,
      window.innerWidth - 16 - roomNeeded,
    );
  } else if (resizing.value === "agent") {
    const roomForViewer =
      window.innerWidth - effectiveBrowserWidth.value - 16 - VIEWER_MIN;
    agentWidth.value = Math.min(
      Math.max(resizeStartWidth - delta, AGENT_MIN),
      AGENT_MAX,
      roomForViewer,
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

async function handleDecide(id, approved) {
  if (!window.api?.decideChange) return;
  const result = await window.api.decideChange(id, approved);
  const status = result?.status || (approved ? "applied" : "rejected");
  if (status === "applied") {
    pendingChanges.value = pendingChanges.value.filter((c) => c.id !== id);
    fileBrowser.value?.refresh?.();
    return;
  }
  pendingChanges.value = pendingChanges.value.map((c) =>
    c.id === id ? { ...c, status } : c,
  );
  if (status === "stale") {
    const file = result?.filePath || pendingChanges.value.find((c) => c.id === id)?.filePath || "the file";
    agentCard.value?.sendSystemMessage?.(
      `Change ${id} for ${file} was not applied: the file changed on disk since the proposal. Re-read it with readFile and propose the change again.`,
    );
  }
}

async function handleDecideAll(approved) {
  const pending = pendingChanges.value.filter((c) => c.status === "pending");
  for (const change of pending) {
    await handleDecide(change.id, approved);
  }
}

onMounted(() => {
  loadModels();
});

onBeforeUnmount(stopResize);
</script>
