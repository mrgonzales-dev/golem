<!--
  TasksPane.vue
  The agent's task plan as a checklist widget inside the chat box.
  Sits at the right edge, 20% wide. Hidden by the parent when the
  plan is empty.

  Props:
    - steps: Array of { text, status }. status is one of
      pending | in_progress | done | verified.

  Emits:
    - taskClick(step, index)  The user clicked a task row.
    - clear                   The user clicked the clear link.
-->
<template>
  <div class="tasks-pane">
    <div class="tasks-header">
      <span class="tasks-title">Tasks</span>
      <span class="tasks-count">{{ doneCount }}/{{ steps.length }}</span>
      <button class="tasks-clear" @click="$emit('clear')" title="Clear the plan">clear</button>
    </div>
    <div class="tasks-list">
      <div
        v-for="(step, i) in steps"
        :key="i"
        class="task-row"
        :class="step.status"
        :title="step.text"
        @click="$emit('taskClick', step, i)"
      >
        <span class="task-mark">{{ markFor(step.status) }}</span>
        <span class="task-text">{{ step.text }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  steps: { type: Array, default: () => [] },
});

defineEmits(["taskClick", "clear"]);

const doneCount = computed(
  () => props.steps.filter((s) => s.status === "done" || s.status === "verified").length,
);

function markFor(status) {
  if (status === "done") return "[x]";
  if (status === "verified") return "[v]";
  if (status === "in_progress") return "[>]";
  return "[ ]";
}
</script>

<style scoped>
.tasks-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  border-left: 1px solid var(--bg-tertiary);
  background-color: var(--bg-secondary);
  font-size: 12px;
}

.tasks-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--bg-tertiary);
  flex-shrink: 0;
}

.tasks-title {
  color: var(--accent-hover);
  font-weight: bold;
}

.tasks-count {
  flex: 1;
  color: var(--text-secondary);
  font-size: 11px;
}

.tasks-clear {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: 11px;
  color: var(--text-secondary);
  cursor: pointer;
}

.tasks-clear:hover {
  color: var(--danger);
  text-decoration: underline;
}

.tasks-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.task-row {
  display: flex;
  gap: 6px;
  padding: 3px 8px;
  cursor: pointer;
  color: var(--text-secondary);
  line-height: 1.4;
}

.task-row:hover {
  background-color: var(--bg-tertiary);
  color: var(--text);
}

.task-row.in_progress {
  color: var(--text);
}

.task-row.in_progress .task-mark {
  color: #58a6ff;
}

.task-row.done,
.task-row.verified {
  opacity: 0.6;
}

.task-row.done .task-text,
.task-row.verified .task-text {
  text-decoration: line-through;
}

.task-row.verified .task-mark {
  color: #56d364;
}

.task-mark {
  flex-shrink: 0;
  font-family: inherit;
}

.task-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
