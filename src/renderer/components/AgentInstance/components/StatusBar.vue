<template>
  <div class="statusline">
    <!-- drop down for model selector -->
    <div class="model-dropdown" ref="dropdownRef">
      <div class="model-display" @click="toggleDropdown">
        <span class="model-name">{{ selectedModel || "Select a model..." }}</span>
        <span class="chevron">{{ dropdownOpen ? "▲" : "▼" }}</span>
      </div>
      <Teleport to="body">
        <div v-if="dropdownOpen" class="model-list" ref="listRef" :style="listStyle">
          <input
            v-model="searchQuery"
            class="model-search"
            placeholder="Search models..."
            ref="searchInput"
            @keydown="onSearchKeydown"
          />
          <div class="model-options">
            <div
              v-for="(model, i) in filteredModels"
              :key="model"
              class="model-option"
              :class="{ active: model === selectedModel, highlighted: i === activeIndex }"
              @click="pickModel(model)"
              @mouseenter="activeIndex = i"
            >
              {{ model }}
            </div>
            <div v-if="filteredModels.length === 0" class="no-results">
              No models found
            </div>
          </div>
        </div>
      </Teleport>
    </div>
    <div class="ctx-meter">
      <div class="ctx-track">
        <div
          class="ctx-fill"
          :class="{ hot: ctxPct >= 90 }"
          :style="{ width: ctxPct + '%' }"
        ></div>
      </div>
      <span class="ctx-label">
        {{ formatTokens(contextUsed) }} / {{ formatTokens(contextMax) }}
      </span>
    </div>
    <button
      class="view-changes-btn"
      :class="{ active: diffOpen, 'has-pending': pendingCount > 0 }"
      @click="$emit('toggleDiff')"
    >
      {{ diffOpen ? "Hide Diff" : "Diff" }}
      <span v-if="pendingCount > 0" class="pending-badge">{{ pendingCount }}</span>
    </button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from "vue";
import { fuzzyFilter } from "../partials/fuzzyFind";

const props = defineProps({
  models: { type: Array, default: () => [] },
  selectedModel: { type: String, default: "" },
  diffOpen: { type: Boolean, default: false },
  pendingCount: { type: Number, default: 0 },
  contextUsed: { type: Number, default: 0 },
  contextMax: { type: Number, default: null },
});

const emit = defineEmits(["update:selectedModel", "toggleDiff"]);

// Context meter: prompt_tokens of the last request against the
// model's context window reported by the provider.
const ctxPct = computed(() => {
  if (!props.contextMax) return 0;
  return Math.min(100, (props.contextUsed / props.contextMax) * 100);
});

function formatTokens(n) {
  if (!n) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const dropdownOpen = ref(false);
const searchQuery = ref("");
const searchInput = ref(null);
const activeIndex = ref(0);
const dropdownRef = ref(null);
const listRef = ref(null);
const listStyle = ref({});

function handleOutsideClick(e) {
  if (!dropdownOpen.value) return;
  const inTrigger = dropdownRef.value && dropdownRef.value.contains(e.target);
  const inList = listRef.value && listRef.value.contains(e.target);
  if (!inTrigger && !inList) {
    dropdownOpen.value = false;
    searchQuery.value = "";
  }
}

onMounted(() => {
  document.addEventListener("click", handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener("click", handleOutsideClick);
});

const filteredModels = computed(() => {
  const list = fuzzyFilter(props.models, searchQuery.value.trim());
  const idx = list.indexOf(props.selectedModel);
  if (idx > 0) {
    list.splice(idx, 1);
    list.unshift(props.selectedModel);
  }
  return list;
});

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value) {
    const rect = dropdownRef.value?.getBoundingClientRect();
    if (rect) {
      listStyle.value = {
        top: `${rect.bottom + 2}px`,
        left: `${rect.left}px`,
      };
    }
    searchQuery.value = "";
    activeIndex.value = 0;
    nextTick(() => searchInput.value?.focus());
  }
}

function pickModel(model) {
  emit("update:selectedModel", model);
  dropdownOpen.value = false;
  searchQuery.value = "";
}

function onSearchKeydown(e) {
  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (activeIndex.value < filteredModels.value.length - 1) {
      activeIndex.value++;
      scrollActiveIntoView();
    }
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (activeIndex.value > 0) {
      activeIndex.value--;
      scrollActiveIntoView();
    }
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (filteredModels.value.length > 0) {
      pickModel(filteredModels.value[activeIndex.value]);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    dropdownOpen.value = false;
    searchQuery.value = "";
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const options = document.querySelector(".model-options");
    const active = options?.children[activeIndex.value];
    if (active) {
      active.scrollIntoView({ block: "nearest" });
    }
  });
}
</script>

<style scoped>
.ctx-meter {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 1 auto;
}

.ctx-track {
  flex: 0 1 80px;
  min-width: 20px;
  height: 22px;
  background-color: var(--bg-tertiary);
  overflow: hidden;
}

.ctx-fill {
  height: 100%;
  background-color: var(--text);
  transition: width 0.2s;
}

.ctx-fill.hot {
  background-color: var(--warning);
}

.ctx-label {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.view-changes-btn {
  margin-left: auto;
  flex-shrink: 0;
  padding: 2px 8px;
  font-size: 11px;
  font-family: inherit;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}

.view-changes-btn:hover {
  color: var(--text);
}

.view-changes-btn.active {
  background-color: var(--text);
  color: var(--bg);
  border-color: var(--text);
}

.pending-badge {
  display: inline-block;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 8px;
  background-color: var(--warning);
  color: var(--bg);
  font-size: 10px;
  font-weight: bold;
}
</style>
