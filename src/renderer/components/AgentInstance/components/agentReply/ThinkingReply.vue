<template>
  <div
    class="agent-thinking-reply"
    :class="{ expanded }"
    @click="expanded = !expanded"
  >
    <span class="thinking-spinner"></span>
    <span v-if="expanded" ref="fullEl" class="thinking-full">{{ full || text }}</span>
    <span v-else class="thinking-text">{{ text }}…</span>
    <span class="thinking-meta">
      (↓ · {{ localElapsed }}s · {{ formatTokens(tokens) }})
    </span>
  </div>
</template>

<script setup>
import { ref, onUnmounted, watch, nextTick } from "vue";

const props = defineProps({
  text: { type: String, required: true },
  full: { type: String, default: null },
  elapsed: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
});

const expanded = ref(false);
const fullEl = ref(null);
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

watch(
  () => [expanded.value, props.full],
  () => {
    if (!expanded.value) return;
    nextTick(() => {
      if (fullEl.value) fullEl.value.scrollTop = fullEl.value.scrollHeight;
    });
  },
);

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
  cursor: pointer;
}

.agent-thinking-reply.expanded {
  align-items: flex-start;
}

.agent-thinking-reply.expanded .thinking-spinner {
  margin-top: 4px;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  flex: 1;
}

.thinking-full {
  white-space: pre-wrap;
  min-width: 0;
  flex: 1;
  overflow-wrap: anywhere;
  max-height: 200px;
  overflow-y: auto;
}

.thinking-meta {
  color: var(--text-secondary);
  font-style: italic;
  font-size: 0.85em;
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
