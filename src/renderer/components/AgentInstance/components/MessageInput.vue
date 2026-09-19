<template>
  <div class="div2">
    <div class="input-row">
      <textarea
        ref="inputEl"
        v-model="text"
        @keydown.enter.exact.prevent="send"
        placeholder="Tell me what you want..."
      ></textarea>
      <button @click="send">Send</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const emit = defineEmits(["send", "sendQueue"]);

const text = ref("");
const inputEl = ref(null);

defineExpose({
  focus: () => inputEl.value?.focus(),
});

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
