<template>
  <div class="msg-user">
    {{ text }}
  </div>
</template>

<script setup>
defineProps({
  text: { type: String, required: true },
});
</script>
