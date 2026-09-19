<template>
  <div class="agent-thinking-reply">
    <span class="thinking-spinner"></span>
    <span class="thinking-text">{{ text }}…</span>
    <span class="thinking-meta">
      (↓ · {{ localElapsed }}s · {{ formatTokens(tokens) }})
    </span>
  </div>
</template>

<script setup>
import { ref, onUnmounted, watch } from "vue";

const props = defineProps({
  text: { type: String, required: true },
  elapsed: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
});

const localElapsed = ref(props.elapsed);
let timer = null;

function startTimer() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    localElapsed.value++;
  }, 1000);
}

startTimer();

watch(() => props.elapsed, (newVal) => {
  if (newVal > localElapsed.value) {
    localElapsed.value = newVal;
  }
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function formatTokens(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k tokens";
  return n + " tokens";
}
</script>

<style scoped>
.agent-thinking-reply {
  color: var(--text-secondary);
  font-size: 12px;
  font-style: italic;
  padding: 4px 8px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.thinking-spinner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--accent);
  flex-shrink: 0;
  display: inline-block;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  0% { transform: scale(0.6); }
  50% { transform: scale(1.2); }
  100% { transform: scale(0.6); }
}

.thinking-text {
  white-space: pre-wrap;
  min-width: 0;
  overflow-wrap: anywhere;
}

.thinking-meta {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.85em;
  white-space: nowrap;
}
</style>
