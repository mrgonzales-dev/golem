<template>
  <div class="div2">
    <div class="input-row">
      <div
        ref="editor"
        class="editor"
        contenteditable="true"
        placeholder="Tell me what you want..."
        @keydown.enter.exact.prevent="onPrimary"
        @paste="onPaste"
        @input="onInput"
      ></div>
      <button :class="{ stop: isStopMode }" @click="onPrimary">
        {{ isStopMode ? "Stop" : "Send" }}
      </button>
    </div>
    <ModelSettings
      :modelName="modelName"
      :effort="effort"
      :effortOptions="effortOptions"
      @update:effort="$emit('update:effort', $event)"
    />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import ModelSettings from "./ModelSettings.vue";
import {
  shouldChip,
  makeBlock,
  chipLabel,
  readNodes,
} from "../partials/pastedBlocks";

const props = defineProps({
  busy: { type: Boolean, default: false },
  modelName: { type: String, default: "" },
  effort: { type: String, default: "default" },
  effortOptions: { type: Array, default: () => ["default", "low", "medium", "high"] },
});

const emit = defineEmits(["send", "sendQueue", "stop", "update:effort"]);

const editor = ref(null);
const blocks = ref([]);
const tick = ref(0);

function blockMap() {
  return new Map(blocks.value.map((b) => [String(b.id), b.text]));
}

function editorEmpty() {
  const el = editor.value;
  if (!el) return true;
  return readNodes(el.childNodes, blockMap()).trim() === "";
}

// Stop mode only while the agent runs and the editor is empty.
// Words or chips keep the button as Send so the message can queue.
const isStopMode = computed(() => {
  void tick.value;
  return props.busy && editorEmpty();
});

defineExpose({
  focus: () => editor.value?.focus(),
});

function onPrimary() {
  if (isStopMode.value) {
    emit("stop");
    return;
  }
  send();
}

function send() {
  const value = readNodes(editor.value?.childNodes || [], blockMap()).trim();
  blocks.value = [];
  if (editor.value) editor.value.innerHTML = "";
  tick.value += 1;
  if (!value) {
    emit("sendQueue");
    return;
  }
  emit("send", value);
}

function caretRange() {
  const el = editor.value;
  el.focus();
  const sel = window.getSelection();
  if (sel.rangeCount) {
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) return range;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  return range;
}

function insertNode(node) {
  const range = caretRange();
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function onPaste(event) {
  const pasted = event.clipboardData?.getData("text") || "";
  if (!shouldChip(pasted)) return;
  event.preventDefault();
  const block = makeBlock(pasted);
  blocks.value.push(block);
  const chip = document.createElement("span");
  chip.className = "paste-chip";
  chip.dataset.bid = String(block.id);
  chip.contentEditable = "false";
  chip.textContent = chipLabel(block);
  chip.title = pasted.slice(0, 200);
  insertNode(chip);
  insertNode(document.createTextNode(" "));
  onInput();
}

function onInput() {
  // Drop blocks whose chip left the DOM (Backspace kills the
  // atomic span in one keypress since it is non-editable).
  const el = editor.value;
  if (el) {
    const live = new Set(
      Array.from(el.querySelectorAll(".paste-chip")).map((c) => c.dataset.bid),
    );
    blocks.value = blocks.value.filter((b) => live.has(String(b.id)));
  }
  tick.value += 1;
}
</script>

<style scoped>
button.stop {
  color: var(--danger);
  border-color: var(--danger);
}

.editor {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  max-height: 220px;
  overflow-y: auto;
  background-color: var(--bg-tertiary);
  color: var(--text);
  font-family: "Fira Code", monospace;
  font-size: 14px;
  line-height: 1.5;
  padding: 4px;
  outline: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
}

.editor:empty::before {
  content: attr(placeholder);
  color: var(--text-secondary);
  pointer-events: none;
}

.editor :deep(.paste-chip) {
  background: none;
  border: none;
  color: #e8a13c;
  font-size: 14px;
  line-height: 1.5;
  padding: 0 2px;
  user-select: none;
  white-space: nowrap;
}
</style>
