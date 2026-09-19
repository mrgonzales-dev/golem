<template>
  <div class="entry-wrapper">
    <div
      class="folder-entry"
      :class="{ selected: isSelected }"
      :style="{ paddingLeft: depth * 12 + 4 + 'px' }"
      @click="handleClick"
    >
      <span
        v-if="entry.isDirectory"
        class="entry-arrow"
        :class="{ expanded: entry.expanded }"
        v-html="arrowIcon"
      ></span>
      <span v-else class="entry-arrow-placeholder"></span>

      <span v-if="entry.isDirectory && entry.expanded" class="entry-icon" v-html="folderOpenIcon"></span>
      <span v-else-if="entry.isDirectory" class="entry-icon" v-html="folderClosedIcon"></span>
      <span v-else class="entry-icon" v-html="fileIcon"></span>

      <span class="entry-name">{{ entry.name }}</span>
    </div>

    <div v-if="entry.isDirectory && entry.expanded" class="folder-entries">
      <FileBrowserEntry
        v-for="child in entry.children"
        :key="child.name"
        :entry="child"
        :depth="depth + 1"
        :basePath="fullPath"
        :selectedFile="selectedFile"
        @select="$emit('select', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import arrowIcon from "../../icons/arrow-icon.svg?raw";
import folderOpenIcon from "../../icons/folder-open-icon.svg?raw";
import folderClosedIcon from "../../icons/folder-open-closed.svg?raw";
import fileIcon from "../../icons/file-icon.svg?raw";

const props = defineProps({
  entry: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  basePath: { type: String, required: true },
  selectedFile: { type: String, default: "" },
});

const emit = defineEmits(["select", "toggle"]);

const fullPath = computed(() => {
  return props.basePath + "/" + props.entry.name;
});

const isSelected = computed(() => {
  return props.selectedFile === fullPath.value;
});

function handleClick() {
  if (props.entry.isDirectory) {
    emit("toggle", { entry: props.entry, path: fullPath.value });
  } else {
    emit("select", fullPath.value);
  }
}
</script>

<style scoped>
.entry-wrapper {
  display: flex;
  flex-direction: column;
}

.folder-entries {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.folder-entry {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 2px 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  border-radius: 3px;
}

.folder-entry:hover {
  background-color: var(--bg-tertiary);
}

.folder-entry.selected {
  background-color: var(--accent);
  color: var(--bg);
}

.entry-arrow {
  flex-shrink: 0;
  display: inline-flex;
  width: 12px;
  height: 12px;
  transition: transform 0.15s ease;
  transform: rotate(0deg);
}

.entry-arrow.expanded {
  transform: rotate(90deg);
}

.entry-arrow :deep(svg) {
  width: 12px;
  height: 12px;
}

.entry-arrow-placeholder {
  flex-shrink: 0;
  width: 12px;
  height: 12px;
}

.entry-icon {
  flex-shrink: 0;
  display: inline-flex;
}

.entry-icon :deep(svg) {
  width: 12px;
  height: 12px;
}

.entry-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
