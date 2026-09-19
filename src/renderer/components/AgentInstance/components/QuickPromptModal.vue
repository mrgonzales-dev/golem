<template>
  <div v-if="open" class="modal-overlay" @click.self="close">
    <div class="modal">
      <div class="modal-header">Add Quick Prompt</div>
      <div class="modal-body">
        <label class="modal-label">Name</label>
        <input
          v-model="name"
          class="modal-input"
          placeholder="Short label for the button"
          @keydown.escape="close"
          ref="nameInput"
        />
        <label class="modal-label">Prompt</label>
        <textarea
          v-model="text"
          class="modal-textarea"
          placeholder="The prompt to send to the agent"
          @keydown.escape="close"
        ></textarea>
      </div>
      <div class="modal-footer">
        <button class="modal-btn modal-btn-cancel" @click="close">Cancel</button>
        <button
          class="modal-btn modal-btn-save"
          :disabled="!canSave"
          @click="save"
        >Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "save"]);

const name = ref("");
const text = ref("");
const nameInput = ref(null);

const canSave = computed(() => {
  return name.value.trim().length > 0 && text.value.trim().length > 0;
});

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    name.value = "";
    text.value = "";
    nextTick(() => nameInput.value?.focus());
  }
});

function close() {
  emit("close");
}

function save() {
  if (!canSave.value) return;
  emit("save", { name: name.value.trim(), text: text.value.trim() });
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.modal {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: bold;
  color: var(--text);
  border-bottom: 1px solid var(--border);
}

.modal-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.modal-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.modal-input {
  background-color: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.modal-input:focus {
  border-color: var(--accent);
}

.modal-textarea {
  background-color: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  resize: vertical;
  min-height: 80px;
  outline: none;
}

.modal-textarea:focus {
  border-color: var(--accent);
}

.modal-footer {
  padding: 8px 12px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid var(--border);
}

.modal-btn {
  padding: 4px 12px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid var(--border);
  background-color: var(--bg-tertiary);
  color: var(--text);
}

.modal-btn:hover {
  border-color: var(--accent);
}

.modal-btn-save {
  background-color: var(--accent);
  color: var(--bg);
  border-color: var(--accent);
}

.modal-btn-save:hover {
  background-color: var(--accent-hover);
}

.modal-btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
