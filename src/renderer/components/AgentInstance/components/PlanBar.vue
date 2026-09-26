<template>
  <div v-if="planMode" class="plan-bar">
    <span class="plan-badge">PLAN</span>
    <span class="plan-hint">Read-only — the agent plans, then you approve</span>
    <button class="plan-create-btn" @click="$emit('createPr')">
      Create Pull Request
    </button>
  </div>
</template>

<script setup>
defineProps({
  planMode: { type: Boolean, default: false },
});

defineEmits(["createPr"]);
</script>

<style scoped>
.plan-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid var(--border);
  background-color: var(--bg);
  padding: 4px 8px;
  flex-shrink: 0;
}

.plan-badge {
  font-size: 10px;
  font-weight: bold;
  padding: 1px 6px;
  border: 1px solid var(--warning);
  color: var(--warning);
  flex-shrink: 0;
}

.plan-hint {
  font-size: 11px;
  color: var(--text-secondary);
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-create-btn {
  background-color: var(--bg-tertiary);
  border: none;
  color: var(--text);
  font-family: inherit;
  font-size: 11px;
  padding: 2px 8px;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
}

.plan-create-btn:hover {
  background-color: var(--accent);
}
</style>
