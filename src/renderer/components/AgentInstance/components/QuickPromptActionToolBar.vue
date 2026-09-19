<!--
  QuickPromptActionToolBar.vue
  A toolbar that sits above the message input.

  Renders saved quick prompt buttons. Clicking a button sends the
  prompt text to the agent. The + button opens a modal to add a
  new quick prompt. Prompts persist to localStorage.

  Props:
    - (none)

  Emits:
    - send(text)  Send a prompt to the agent.
-->
<template>
  <div class="quick-action-bar">
    <button
      v-for="prompt in prompts"
      :key="prompt.id"
      class="quick-btn"
      @click="$emit('send', prompt.text)"
      :title="prompt.text"
    >{{ prompt.name }}</button>
    <span class="quick-btn-separator quick-btn-end"></span>
    <button class="quick-btn quick-btn-add" @click="openModal">+</button>
    <QuickPromptModal
      :open="modalOpen"
      @close="closeModal"
      @save="handleSave"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import QuickPromptModal from "./QuickPromptModal.vue";
import { loadPrompts, addPrompt, createPrompt } from "../partials/quickPrompts";

defineEmits(["send"]);

const prompts = ref([]);
const modalOpen = ref(false);

onMounted(() => {
  prompts.value = loadPrompts();
});

function openModal() {
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

function handleSave({ name, text }) {
  const prompt = createPrompt(name, text);
  prompts.value = addPrompt(prompts.value, prompt);
  closeModal();
}
</script>

<style scoped>
.quick-action-bar {
  border: 1px solid var(--accent);
  background-color: var(--accent);
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 0 8px;
  gap: 4px;
  flex-shrink: 0;
}

.quick-btn {
  padding: 2px 8px;
  font-size: 11px;
  font-family: inherit;
  background-color: transparent;
  color: var(--bg);
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.quick-btn:hover {
  background-color: var(--bg);
  color: var(--text);
}

.quick-btn-add {
  background-color: transparent;
  color: var(--bg);
  font-weight: bold;
  padding: 2px 8px;
  border: 1px solid transparent;
}

.quick-btn-add:hover {
  background-color: var(--bg);
  color: var(--text);
}

.quick-btn-separator {
  width: 1px;
  height: 16px;
  background-color: var(--bg);
  opacity: 0.35;
  flex-shrink: 0;
}

.quick-btn-end {
  margin-left: auto;
}
</style>
