<!--
  DiffCard.vue
  Renders one pending change: header (file name, status) and its
  diff hunks with per-line numbers and line-level coloring.

  Props:
    - change: {
        id:       The pending change id.
        filePath: The file the change applies to.
        tool:     "updateFile" or "writeFile".
        status:   "pending" | "applied" | "rejected" | "stale".
        reason:   One-sentence explanation from the model.
        hunks:    Array of { startLine, fromLine, lines: [{ type, text }] }.
      }
-->
<template>
  <div class="diff-card">
    <div class="diff-card-header">
      <span class="diff-card-path">{{ fileName }}</span>
      <span class="diff-card-status" :class="change.status">{{ change.status }}</span>
    </div>
    <div v-for="(hunk, h) in change.hunks" :key="h" class="diff-hunk">
      <div class="diff-hunk-label">line {{ hunk.startLine }}</div>
      <div class="diff-lines">
        <div
          v-for="(line, j) in numberedLines(hunk)"
          :key="j"
          class="diff-line"
          :class="line.type"
        ><span class="diff-num">{{ line.num }}</span><span class="diff-sign">{{ signFor(line.type) }}</span><span class="diff-text">{{ line.text }}</span></div>
      </div>
    </div>
    <div v-if="change.reason" class="diff-reason">
      {{ change.reason }}
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  change: { type: Object, required: true },
});

const fileName = computed(() => props.change.filePath.split(/[\\/]/).pop());

function signFor(type) {
  if (type === "add") return "+";
  if (type === "remove") return "-";
  return " ";
}

// Removes count against the old file, adds against the new file,
// keeps against both. The hunk's first line is fromLine.
function numberedLines(hunk) {
  let oldN = hunk.fromLine ?? hunk.startLine;
  let newN = hunk.fromLine ?? hunk.startLine;
  return hunk.lines.map((line) => {
    let num;
    if (line.type === "remove") num = oldN++;
    else if (line.type === "add") num = newN++;
    else num = oldN++, newN++;
    return { ...line, num };
  });
}
</script>

<style scoped>
.diff-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
  user-select: none;
}

.diff-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  border-bottom: 1px solid var(--border);
  background-color: var(--bg-secondary);
}

.diff-card-path {
  color: var(--accent-hover);
  font-weight: bold;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.diff-card-status {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-secondary);
}

.diff-card-status.pending {
  color: var(--warning);
}

.diff-card-status.applied {
  color: #56d364;
}

.diff-card-status.rejected,
.diff-card-status.stale,
.diff-card-status.error {
  color: #f85149;
}

.diff-hunk-label {
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border);
  background-color: var(--bg);
}

.diff-lines {
  font-size: 12px;
}

.diff-line {
  display: flex;
  padding: 0 8px 0 0;
}

.diff-num {
  display: inline-block;
  width: 36px;
  padding-right: 8px;
  text-align: right;
  color: var(--text-secondary);
  opacity: 0.6;
  user-select: none;
  flex-shrink: 0;
}

.diff-sign {
  display: inline-block;
  width: 14px;
  color: var(--text-secondary);
  user-select: none;
  flex-shrink: 0;
}

.diff-text {
  flex: 1;
  min-width: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  user-select: text;
  cursor: text;
}

.diff-line.add {
  background-color: #3fb95022;
  color: #56d364;
}

.diff-line.remove {
  background-color: #f8514922;
  color: #f85149;
}

.diff-line.keep {
  color: var(--text-secondary);
}

.diff-reason {
  padding: 6px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
  background-color: var(--bg-secondary);
  user-select: text;
  line-height: 1.4;
}
</style>
