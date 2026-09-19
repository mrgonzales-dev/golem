<template>
  <div class="agent-tool-group">
    <div class="group-header">
      <span class="tool-marker" :class="groupStatus">●</span>
      <span class="tool-name">{{ label }}</span>
      <span class="tool-count">{{ doneCount }}/{{ items.length }}</span>
    </div>
    <div class="group-items">
      <div
        v-for="item in items"
        :key="item.callId"
        class="group-item"
      >
        <span class="item-marker" :class="item.status">○</span>
        <span class="item-arg">{{ formatArgs(tool, item.args) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { toolLabel, formatToolArgs, aggregateStatus } from "../../partials/toolCalls";

const props = defineProps({
  tool: { type: String, required: true },
  items: { type: Array, required: true },
});

const label = computed(() => toolLabel(props.tool));
const groupStatus = computed(() => aggregateStatus(props.items));
const doneCount = computed(
  () => props.items.filter((i) => i.status === "done").length,
);

function formatArgs(tool, args) {
  return formatToolArgs(tool, args);
}
</script>

<style scoped>
.agent-tool-group {
  color: var(--text-secondary);
  padding: 4px 8px;
  margin-bottom: 4px;
  font-size: 0.9em;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-marker {
  flex-shrink: 0;
}

.tool-marker.running {
  color: var(--accent);
  display: inline-block;
  animation: pulse 1s ease-in-out infinite;
}

.tool-marker.done {
  color: var(--success);
}

.tool-marker.error {
  color: var(--danger);
}

.tool-name {
  color: var(--accent-hover);
  font-weight: bold;
}

.tool-count {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.group-items {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 20px;
}

.group-item {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
}

.item-marker {
  flex-shrink: 0;
  font-size: 0.85em;
}

.item-marker.running {
  color: var(--accent);
  display: inline-block;
  animation: pulse 1s ease-in-out infinite;
}

.item-marker.done {
  color: var(--success);
}

.item-marker.error {
  color: var(--danger);
}

.item-arg {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes pulse {
  0% { transform: scale(0.6); }
  50% { transform: scale(1.2); }
  100% { transform: scale(0.6); }
}
</style>
