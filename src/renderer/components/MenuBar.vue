<template>
  <div class="menu-bar">
    <button
      class="menu-item"
      :class="{ active: browserVisible }"
      @click="$emit('toggleBrowser')"
    >Browser</button>
    <button class="menu-item" disabled>Terminal</button>
    <button class="menu-item" @click="$emit('openSettings')">Settings</button>
  </div>
</template>

<script setup>
defineProps({
  browserVisible: { type: Boolean, default: true },
});

defineEmits(["openSettings", "toggleBrowser"]);
</script>

<style scoped>
.menu-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  background: none;
  flex-shrink: 0;
  user-select: none;
  -webkit-app-region: no-drag;
}

.menu-item {
  background: none;
  border: none;
  padding: 2px 4px;
  font-size: 12px;
  font-family: inherit;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 0;
  align-self: auto;
}

.menu-item:hover:not(:disabled) {
  color: var(--text);
  background: none;
}

.menu-item.active {
  color: var(--text);
}

.menu-item:disabled {
  opacity: 0.5;
  cursor: default;
  background: none;
}
</style>
