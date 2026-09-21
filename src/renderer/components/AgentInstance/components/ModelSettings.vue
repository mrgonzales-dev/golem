<template>
  <div class="model-settings">
    <span class="ms-model">{{ modelName || "No model" }}</span>
    <template v-if="effortOptions.length > 1">
      <label class="ms-label">Thinking</label>
      <select
        class="ms-select"
        :value="effort"
        @change="$emit('update:effort', $event.target.value)"
      >
        <option v-for="o in effortOptions" :key="o" :value="o">
          {{ o === "default" ? "Default" : o[0].toUpperCase() + o.slice(1) }}
        </option>
      </select>
      <span class="ms-arrow">▼</span>
    </template>
  </div>
</template>

<script setup>
defineProps({
  modelName: { type: String, default: "" },
  effort: { type: String, default: "default" },
  effortOptions: { type: Array, default: () => ["default", "low", "medium", "high"] },
});

defineEmits(["update:effort"]);
</script>

<style scoped>
.model-settings {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  user-select: none;
}

.ms-model {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ms-label {
  flex-shrink: 0;
}

.ms-select {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: 11px;
  padding: 0;
  outline: none;
  flex-shrink: 0;
  cursor: pointer;
}

.ms-select:hover {
  color: var(--text);
}

.ms-select option {
  background-color: var(--bg);
  color: var(--text);
}

.ms-arrow {
  font-size: 8px;
  color: var(--text-secondary);
  margin-left: -4px;
}
</style>
