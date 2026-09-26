<template>
  <div class="pr-page">
    <div class="pr-header">
      <span class="pr-heading">Pull Requests</span>
      <span class="pr-count" v-if="prs.length">{{ prs.length }}</span>
      <button class="pr-close" @click="$emit('close')" title="Back to chat">&times;</button>
    </div>
    <div class="pr-list">
      <div v-if="!prs.length" class="pr-empty">
        No pull requests. Type /plan to start one.
      </div>
      <div v-for="pr in prs" :key="pr.id" class="pr-row">
        <div class="pr-main">
          <span class="pr-title">{{ pr.title }}</span>
          <span class="pr-status" :data-status="pr.status">{{ pr.status }}</span>
        </div>
        <div v-if="pr.description" class="pr-desc">{{ pr.description }}</div>
        <div class="pr-actions">
          <button
            class="pr-btn"
            :disabled="pr.status !== 'open'"
            @click="$emit('implement', pr.id)"
          >Implement</button>
          <button class="pr-btn" @click="$emit('send', pr.id)">Send to Agent</button>
          <button class="pr-btn pr-btn-danger" @click="$emit('remove', pr.id)">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  prs: { type: Array, default: () => [] },
});
defineEmits(["close", "implement", "send", "remove"]);
</script>

<style scoped>
.pr-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.pr-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.pr-heading {
  font-size: 12px;
  color: var(--text);
}

.pr-count {
  font-size: 10px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.pr-close {
  margin-left: auto;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}

.pr-close:hover {
  color: var(--text);
}

.pr-list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pr-empty {
  color: var(--text-secondary);
  font-size: 12px;
  padding: 16px;
  text-align: center;
}

.pr-row {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pr-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pr-title {
  font-size: 12px;
  color: var(--text);
}

.pr-status {
  font-size: 10px;
  padding: 0 6px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  text-transform: uppercase;
}

.pr-status[data-status="implemented"] {
  color: var(--success);
  border-color: var(--success);
}

.pr-status[data-status="closed"] {
  color: var(--danger);
  border-color: var(--danger);
}

.pr-desc {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: pre-wrap;
}

.pr-actions {
  display: flex;
  gap: 6px;
}

.pr-btn {
  background: var(--bg-tertiary);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

.pr-btn:hover:not(:disabled) {
  border-color: var(--accent);
}

.pr-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.pr-btn-danger:hover:not(:disabled) {
  border-color: var(--danger);
}
</style>
