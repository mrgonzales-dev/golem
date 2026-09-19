<!--
  DiffBox.vue
  Shows pending file changes proposed by the agent as diff cards.
  Renders as a side panel beside the agent instance, toggled by
  the "View Changes" button in StatusBar.

  Props:
    - changes: Array of change objects (see DiffCard.vue for shape).

  Emits:
    - decideAll(approved)  The user clicked Approve All or Reject All.
-->
<template>
  <div class="div1 diff-box">
    <div class="diff-scroll">
      <div v-if="changes.length === 0" class="diff-empty">
        No pending changes.
      </div>
      <DiffCard v-for="change in changes" :key="change.id" :change="change" />
    </div>
    <div class="diff-toolbar" v-if="pendingCount > 0">
      <span class="diff-toolbar-count">{{ pendingCount }} pending</span>
      <button class="diff-btn approve" @click="$emit('decideAll', true)">Approve All</button>
      <button class="diff-btn reject" @click="$emit('decideAll', false)">Reject All</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import DiffCard from "./DiffCard.vue";

const props = defineProps({
  changes: { type: Array, default: () => [] },
});

defineEmits(["decideAll"]);

const pendingCount = computed(
  () => props.changes.filter((c) => c.status === "pending").length,
);
</script>

<style scoped>
.diff-box {
  grid-column: 5;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.diff-scroll {
  flex: 1;
  overflow-y: auto;
}

.diff-empty {
  color: var(--text-secondary);
  font-size: 12px;
  text-align: center;
  padding: 16px 4px;
}

.diff-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.diff-toolbar-count {
  flex: 1;
  font-size: 11px;
  color: var(--warning);
}

.diff-btn {
  padding: 2px 10px;
  font-size: 11px;
  font-family: inherit;
  border: 1px solid var(--border);
  border-radius: 4px;
  cursor: pointer;
  background-color: transparent;
}

.diff-btn.approve {
  color: var(--success);
}

.diff-btn.approve:hover {
  background-color: #ffffff14;
}

.diff-btn.reject {
  color: var(--danger);
}

.diff-btn.reject:hover {
  background-color: #ffffff0a;
}
</style>
