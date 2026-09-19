<!--
  AgentInstanceCard.vue
  A self-contained agent card that bundles the model selector,
  chat box, quick prompt toolbar, and message input.

  Props:
    - models: Array of available model names.
    - folderPath: The shared working directory path.

  State owned by this card:
    - messages, queue, isResponding, selectedModel
-->
<template>
  <div class="agent-card">
    <StatusBar
      :models="models"
      v-model:selectedModel="selectedModel"
      :diffOpen="diffOpen"
      :pendingCount="pendingCount"
      :contextUsed="contextTokens"
      :contextMax="contextMax"
      @toggleDiff="emit('update:diffOpen', !diffOpen)"
    />
    <div class="chat-row">
      <ChatBox
        v-if="!diffOpen"
        class="chat-pane"
        :messages="messages"
        :queue="queue"
        :isResponding="isResponding"
        @sendQueue="flushQueue"
        @focusInput="messageInput?.focus()"
      />
      <DiffBox
        v-else
        class="diff-pane"
        :changes="pendingChanges"
        @decideAll="emit('decideAll', $event)"
      />
    </div>
    <QuickPromptActionToolBar @send="handleSend" />
    <MessageInput
      ref="messageInput"
      :busy="isResponding"
      @send="handleSend"
      @sendQueue="flushQueue"
      @stop="stopAgent"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue";

import StatusBar from "./components/StatusBar.vue";
import ChatBox from "./components/ChatBox.vue";
import DiffBox from "./components/diffPanel/DiffBox.vue";
import MessageInput from "./components/MessageInput.vue";
import QuickPromptActionToolBar from "./components/QuickPromptActionToolBar.vue";
import { applyToolCall } from "./partials/toolCalls";
import { shouldFlush, dequeue, handleSend as queueSend } from "./partials/agentQueue";
import { getProviderConfig } from "../Settings/partials/providerConfig";

const props = defineProps({
  models: { type: Array, default: () => [] },
  modelContextMap: { type: Object, default: () => ({}) },
  folderPath: { type: String, default: "" },
  diffOpen: { type: Boolean, default: false },
  pendingChanges: { type: Array, default: () => [] },
});

const emit = defineEmits([
  "update:diffOpen",
  "update:pendingChanges",
  "decideAll",
]);

const messages = ref([]);
const queue = ref([]);
const messageInput = ref(null);
const isResponding = ref(false);
const selectedModel = ref("");

const pendingCount = computed(
  () => props.pendingChanges.filter((c) => c.status === "pending").length,
);

// Context meter: prompt_tokens of the last request approximates the
// full conversation size. Max is the provider-reported context length
// for the selected model, defaulting to 1M when unknown.
const contextTokens = ref(0);

const contextMax = computed(
  () => props.modelContextMap[selectedModel.value] || 1000000,
);

watch(selectedModel, (newModel) => {
  localStorage.setItem("selectedModel", newModel);
});

function loadSavedModel() {
  selectedModel.value = localStorage.getItem("selectedModel") || "";
}

function handleSend(text) {
  const result = queueSend(queue.value, isResponding.value, text);
  queue.value = result.queue;

  if (result.action === "send") {
    sendMessage(result.text);
  }
}

// Send a system instruction to the agent (e.g. a stale change asks
// for a re-read and a new proposal). Queues like a user message when
// the agent is busy.
function sendSystemMessage(text) {
  const result = queueSend(queue.value, isResponding.value, text);
  queue.value = result.queue;
  if (result.action === "send") {
    sendMessage(result.text, "System");
  }
}

defineExpose({ sendSystemMessage });

function stopAgent() {
  if (window.api.interruptChat) window.api.interruptChat();
}

function flushQueue() {
  const action = shouldFlush(queue.value, isResponding.value);

  if (action === "noop") return;

  if (action === "interrupt") {
    if (window.api.interruptChat) window.api.interruptChat();
    return;
  }

  const { item, rest } = dequeue(queue.value);
  queue.value = rest;
  if (item) sendMessage(item);
}

async function sendMessage(text, sender = "You") {
  isResponding.value = true;
  messages.value.push({ sender, text });

  let thinkingId = messages.value.length;
  messages.value.push({ sender: "Thinking", text: "Thinking", elapsed: 0, tokens: 0 });

  let stopThinkingListener = null;
  let stopToolListener = null;

  const handleThinking = (data) => {
    if (messages.value[thinkingId]?.sender !== "Thinking") return;
    messages.value[thinkingId] = {
      sender: "Thinking",
      text: data.text,
      elapsed: data.elapsed,
      tokens: data.tokens,
    };
  };

  const handleToolCall = (data) => {
    const result = applyToolCall(messages.value, thinkingId, data);
    messages.value = result.messages;
    thinkingId = result.thinkingId;
  };

  if (window.api.onThinking) {
    stopThinkingListener = window.api.onThinking(handleThinking);
  }
  if (window.api.onToolCall) {
    stopToolListener = window.api.onToolCall(handleToolCall);
  }

  try {
    const { host, apiKey } = getProviderConfig();
    const result = await window.api.chat(text, selectedModel.value, props.folderPath, host, apiKey);
    if (result.ok) {
      messages.value[thinkingId] = { sender: "AI", text: result.reply };
    } else if (result.error === "Interrupted") {
      messages.value[thinkingId] = { sender: "Interrupted", text: "Interrupted" };
    } else {
      messages.value[thinkingId] = { sender: "Error", text: result.error };
    }
  } catch (err) {
    messages.value[thinkingId] = { sender: "Error", text: err.message };
  } finally {
    if (stopThinkingListener) stopThinkingListener();
    if (stopToolListener) stopToolListener();
    isResponding.value = false;
    if (queue.value.length > 0) {
      const { item, rest } = dequeue(queue.value);
      queue.value = rest;
      if (item) sendMessage(item);
    }
  }
}

onMounted(() => {
  loadSavedModel();

  // Change events are not tied to a single message: proposals can
  // arrive during a turn and decisions can land after it ends.
  if (window.api.onChange) {
    window.api.onChange((data) => {
      // A merge re-emits the card with the same id — replace it.
      const next = props.pendingChanges.some((c) => c.id === data.id)
        ? props.pendingChanges.map((c) => (c.id === data.id ? data : c))
        : [...props.pendingChanges, data];
      emit("update:pendingChanges", next);
      emit("update:diffOpen", true);
    });
  }
  if (window.api.onUsage) {
    window.api.onUsage(({ promptTokens }) => {
      contextTokens.value = promptTokens;
    });
  }
  if (window.api.onChangeStatus) {
    window.api.onChangeStatus(({ id, status }) => {
      emit(
        "update:pendingChanges",
        props.pendingChanges.map((c) => (c.id === id ? { ...c, status } : c)),
      );
    });
  }
});

watch(
  () => props.models,
  (models) => {
    if (models.length > 0 && !selectedModel.value) {
      selectedModel.value = models[0];
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.agent-card > :deep(.statusline) {
  flex-shrink: 0;
}

.chat-row {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.chat-pane,
.diff-pane {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.agent-card > :deep(.quick-action-bar) {
  flex-shrink: 0;
}

.agent-card > :deep(.div2) {
  flex-shrink: 0;
}
</style>
