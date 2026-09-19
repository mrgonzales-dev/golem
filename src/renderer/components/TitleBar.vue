<template>
  <div class="title-bar" :class="{ 'title-bar-left': isMac }">
    <div class="traffic-lights">
      <template v-if="isMac">
        <button class="traffic-light traffic-light-close" @click="close"></button>
        <button class="traffic-light traffic-light-minimize" @click="minimize"></button>
        <button class="traffic-light traffic-light-maximize" @click="maximize"></button>
      </template>
      <template v-else>
        <button class="traffic-light traffic-light-minimize" @click="minimize"></button>
        <button class="traffic-light traffic-light-maximize" @click="maximize"></button>
        <button class="traffic-light traffic-light-close" @click="close"></button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const isMac = computed(() => window.api?.platform === "darwin");

function close() {
  if (window.api?.windowClose) window.api.windowClose();
}

function minimize() {
  if (window.api?.windowMinimize) window.api.windowMinimize();
}

function maximize() {
  if (window.api?.windowMaximize) window.api.windowMaximize();
}
</script>

<style scoped>
.title-bar {
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 12px;
  -webkit-app-region: drag;
  flex-shrink: 0;
}

.title-bar-left {
  justify-content: flex-start;
}

.traffic-lights {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.traffic-light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  padding: 0;
  display: inline-block;
}

.traffic-light-close {
  background-color: #b0b0b0;
}

.traffic-light-minimize {
  background-color: #7a7a7a;
}

.traffic-light-maximize {
  background-color: #4a4a4a;
}

.traffic-light:hover {
  opacity: 0.8;
}
</style>
