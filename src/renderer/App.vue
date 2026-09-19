<template>
  <div class="app-shell">
    <TitleBar />
    <div class="parent" :class="{ resizing: resizing }" :style="parentStyle">
      <FileBrowserPanel ref="fileBrowser" :folderPath="folderPath" @selectFolder="selectFolder" @settingsSaved="loadModels" />
      <div
        class="pane-resizer"
        :class="{ active: resizing === 'browser' }"
        @mousedown.prevent="startResize('browser', $event)"
      ></div>
      <AgentInstanceCard
        ref="agentCard"
        :models="models"
        :folderPath="folderPath"
        v-model:diffOpen="diffOpen"
        v-model:pendingChanges="pendingChanges"
      />
      <template v-if="diffOpen">
        <div
          class="pane-resizer"
          :class="{ active: resizing === 'diff' }"
          @mousedown.prevent="startResize('diff', $event)"
        ></div>
        <DiffBox :changes="pendingChanges" @decideAll="handleDecideAll" />
      </template>
    </div>
  </div>
</template>

<script setup>

import {ref, computed, onMounted, onBeforeUnmount} from "vue";
import "./style.css";
import FileBrowserPanel from "./components/FileBrowserPanel.vue";
import TitleBar from "./components/TitleBar.vue";
import AgentInstanceCard from "./components/AgentInstance/AgentInstanceCard.vue";
import DiffBox from "./components/DiffPanel/DiffBox.vue";
import { getProviderConfig, hasProviderConfig } from "./components/Settings/partials/providerConfig";

const models = ref([]);
const folderPath = ref("");
const diffOpen = ref(false);
const pendingChanges = ref([]);
const agentCard = ref(null);
const fileBrowser = ref(null);

const browserWidth = ref(200);
const diffWidth = ref(340);
const resizing = ref(null);
let resizeStartX = 0;
let resizeStartWidth = 0;

const PANE_LIMITS = {
  browser: { min: 140, max: 480 },
  diff: { min: 220, max: 720 },
};

const parentStyle = computed(() => ({
  gridTemplateColumns: diffOpen.value
    ? `${browserWidth.value}px 8px minmax(0, 1fr) 8px ${diffWidth.value}px`
    : `${browserWidth.value}px 8px minmax(0, 1fr)`,
}));

function startResize(pane, event) {
  resizing.value = pane;
  resizeStartX = event.clientX;
  resizeStartWidth = pane === "browser" ? browserWidth.value : diffWidth.value;
  window.addEventListener("mousemove", onResizeMove);
  window.addEventListener("mouseup", stopResize);
}

function onResizeMove(event) {
  if (!resizing.value) return;
  const { min, max } = PANE_LIMITS[resizing.value];
  const delta = event.clientX - resizeStartX;
  const next = resizing.value === "browser"
    ? resizeStartWidth + delta
    : resizeStartWidth - delta;
  const clamped = Math.min(Math.max(next, min), max);
  if (resizing.value === "browser") {
    browserWidth.value = clamped;
  } else {
    diffWidth.value = clamped;
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
