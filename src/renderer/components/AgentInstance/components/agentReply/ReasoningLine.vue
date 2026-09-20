<template>
  <div class="reasoning-line">
    <span class="reasoning-text">{{ text }}</span>
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, required: true },
});
</script>

<style scoped>
.reasoning-line {
  color: var(--text-secondary);
  font-size: 12px;
  font-style: italic;
  padding: 4px 8px;
  margin-bottom: 8px;
}

.reasoning-text {
  white-space: pre-wrap;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
