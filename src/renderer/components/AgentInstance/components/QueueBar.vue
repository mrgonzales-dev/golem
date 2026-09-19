<template>
  <div v-if="queue.length > 0" class="queue-bar">
    <div class="queue-divider">
      <span class="queue-count">── {{ queue.length }} queued ──</span>
      <span class="queue-divider-line"></span>
      <button class="queue-send-btn" @click="$emit('sendQueue')">↵ send now</button>
    </div>
    <div class="queue-items">
      <div v-for="(item, i) in queue" :key="i" class="queue-item">
        <span class="queue-bullet">○</span>
        <span class="queue-text">{{ item }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  queue: { type: Array, default: () => [] },
  isResponding: { type: Boolean, default: false },
});

defineEmits(["sendQueue", "interrupt"]);
</script>

<style scoped>
.queue-bar {
  border-top: 1px solid var(--border);
  background-color: var(--bg);
  padding: 4px 8px;
  font-family: "Space Mono", monospace;
  font-size: 12px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.queue-divider {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.queue-count {
  color: var(--text-secondary);
  white-space: nowrap;
}

.queue-divider-line {
  flex: 1;
  border-bottom: 1px dashed var(--border);
}

.queue-hint {
  color: var(--text-secondary);
  white-space: nowrap;
  font-size: 11px;
}

.queue-send-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
  white-space: nowrap;
}

.queue-send-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}

.queue-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 0;
}

.queue-item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
}

.queue-bullet {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.queue-text {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
