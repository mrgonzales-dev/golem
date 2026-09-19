<template>
  <div class="agent-error" :class="type">
    <span class="error-marker">{{ marker }}</span>
    <span class="error-text">{{ text }}</span>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  text: { type: String, required: true },
  type: { type: String, default: "error" },
});

const marker = computed(() => {
  if (props.type === "interrupted") return "—";
  if (props.type === "notice") return "•";
  return "!";
});
</script>

<style scoped>
.agent-error {
  color: var(--text-secondary);
  padding: 2px 8px;
  margin-bottom: 4px;
  font-size: 0.85em;
  font-style: italic;
  display: flex;
  align-items: center;
  gap: 6px;
  border-left: 2px solid var(--border);
}

.error-marker {
  flex-shrink: 0;
  color: var(--text-secondary);
  font-weight: bold;
}

.error-text {
  color: var(--text-secondary);
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
