<template>
  <div class="code-viewer">
    <div class="cv-header">
      <span class="cv-filename">{{ fileName }}</span>
      <span v-if="truncated" class="cv-flag">truncated</span>
      <button class="cv-close" @click="$emit('close')">×</button>
    </div>
    <div class="cv-body">
      <div v-if="loading" class="cv-empty">Loading...</div>
      <div v-else-if="error" class="cv-empty">{{ error }}</div>
      <div v-else class="cv-lines">
        <div v-for="(line, i) in lines" :key="i" class="cv-line">
          <span class="cv-num">{{ i + 1 }}</span>
          <span class="cv-text" v-html="line"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { highlightLines } from "./partials/highlight";

const props = defineProps({
  filePath: { type: String, default: "" },
});

defineEmits(["close"]);

const content = ref("");
const loading = ref(false);
const error = ref("");
const truncated = ref(false);

const fileName = computed(() => {
  const parts = props.filePath.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || props.filePath;
});

const lines = computed(() => highlightLines(content.value, props.filePath));

async function loadFile() {
  if (!props.filePath || !window.api?.readFileContent) return;
  loading.value = true;
  error.value = "";
  content.value = "";
  truncated.value = false;
  try {
    const result = await window.api.readFileContent(props.filePath);
    if (result.ok) {
      content.value = result.content;
      truncated.value = result.truncated;
    } else {
      error.value = result.error;
    }
  } catch (err) {
    error.value = err.message;
  }
  loading.value = false;
}

watch(() => props.filePath, loadFile, { immediate: true });
</script>

<style scoped>
.code-viewer {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  background-color: var(--bg);
  min-height: 0;
  min-width: 0;
}

.cv-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  background-color: var(--bg);
  flex-shrink: 0;
  user-select: none;
}

.cv-filename {
  font-size: 12px;
  font-weight: bold;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cv-flag {
  font-size: 10px;
  color: var(--warning);
  flex-shrink: 0;
}

.cv-close {
  margin-left: auto;
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.cv-close:hover {
  color: var(--text);
}

.cv-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.cv-empty {
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  padding: 16px 8px;
}

.cv-lines {
  font-size: 12px;
  padding: 4px 0;
}

.cv-line {
  display: flex;
}

.cv-num {
  display: inline-block;
  width: 44px;
  padding-right: 8px;
  text-align: right;
  color: var(--text-secondary);
  opacity: 0.6;
  user-select: none;
  flex-shrink: 0;
}

.cv-text {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
  padding-right: 8px;
}

/* Grayscale hljs theme — the palette has no colors, so tokens
   differ by brightness and weight instead of hue. */
.cv-text :deep(.hljs-comment),
.cv-text :deep(.hljs-quote) {
  color: var(--text-secondary);
  font-style: italic;
}

.cv-text :deep(.hljs-keyword),
.cv-text :deep(.hljs-selector-tag),
.cv-text :deep(.hljs-meta) {
  color: var(--accent-hover);
  font-weight: bold;
}

.cv-text :deep(.hljs-string),
.cv-text :deep(.hljs-regexp),
.cv-text :deep(.hljs-addition) {
  color: var(--text);
}

.cv-text :deep(.hljs-number),
.cv-text :deep(.hljs-literal),
.cv-text :deep(.hljs-built_in),
.cv-text :deep(.hljs-type) {
  color: var(--accent-hover);
}

.cv-text :deep(.hljs-title),
.cv-text :deep(.hljs-name),
.cv-text :deep(.hljs-section) {
  color: var(--text);
  font-weight: bold;
}

.cv-text :deep(.hljs-attr),
.cv-text :deep(.hljs-attribute),
.cv-text :deep(.hljs-variable),
.cv-text :deep(.hljs-template-variable) {
  color: var(--text);
}

.cv-text :deep(.hljs-deletion),
.cv-text :deep(.hljs-symbol) {
  color: var(--danger);
}
</style>
