<template>
  <div class="div2">
    <div class="input-row">
      <textarea
        ref="inputEl"
        v-model="text"
        @keydown.enter.exact.prevent="onPrimary"
        placeholder="Tell me what you want..."
      ></textarea>
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

const props = defineProps({
  busy: { type: Boolean, default: false },
  modelName: { type: String, default: "" },
  effort: { type: String, default: "off" },
  effortOptions: { type: Array, default: () => ["off", "low", "medium", "high"] },
});

const emit = defineEmits(["send", "sendQueue", "stop", "update:effort"]);

const text = ref("");
const inputEl = ref(null);

// Stop mode only while the agent runs and the input is empty.
// Typed text keeps the button as Send so the message can queue.
const isStopMode = computed(() => props.busy && !text.value.trim());

defineExpose({
  focus: () => inputEl.value?.focus(),
});

function onPrimary() {
  if (isStopMode.value) {
    emit("stop");
    return;
  }
  send();
}

function send() {
  const value = text.value.trim();
  if (!value) {
    emit("sendQueue");
    return;
  }
  emit("send", value);
  text.value = "";
}
</script>

<style scoped>
button.stop {
  color: var(--danger);
  border-color: var(--danger);
}
</style>
