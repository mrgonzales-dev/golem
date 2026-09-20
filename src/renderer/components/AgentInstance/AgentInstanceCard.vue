<!--
  AgentInstanceCard.vue
  A self-contained agent card that bundles the model selector,
  chat box, file pane, diff box, quick prompt toolbar, and message input.

  Props:
    - models: Array of available model names.
    - folderPath: The shared working directory path.
    - diffOpen: True shows the diff box in place of chat.
    - pendingChanges: Array of pending change objects.
    - viewingFile: Path of the open file. Shows file pane in place of chat.

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
      <CodeViewer
        v-if="viewingFile"
        class="file-pane"
        :filePath="viewingFile"
        @close="emit('update:viewingFile', '')"
      />
      <DiffBox
        v-else-if="diffOpen"
        class="diff-pane"
        :changes="pendingChanges"
        @decideAll="emit('decideAll', $event)"
      />
      <ChatBox
        v-else
        class="chat-pane"
        :messages="messages"
        :queue="queue"
        :isResponding="isResponding"
        @sendQueue="flushQueue"
        @focusInput="messageInput?.focus()"
      />
    </div>
    <QuickPromptActionToolBar @send="handleSend" />
    <MessageInput
      ref="messageInput"
      :busy="isResponding"
      :modelName="selectedModel"
      :effort="thinkingEffort"
      @update:effort="thinkingEffort = $event"
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
import CodeViewer from "./components/filePane/CodeViewer.vue";
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
  viewingFile: { type: String, default: "" },
});

const emit = defineEmits([
  "update:diffOpen",
  "update:pendingChanges",
  "update:viewingFile",
  "openSettings",
  "decideAll",
]);

const messages = ref([]);
const queue = ref([]);
const messageInput = ref(null);
const isResponding = ref(false);
// Restored from localStorage; validated against the fetched model
// list in the watcher below so a stale name falls back to models[0].
const selectedModel = ref(localStorage.getItem("selectedModel") || "");
// Thinking effort sent as reasoning_effort. Off omits the field.
const thinkingEffort = ref(localStorage.getItem("thinkingEffort") || "off");

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
  if (newModel) localStorage.setItem("selectedModel", newModel);
});

watch(thinkingEffort, (newEffort) => {
  if (newEffort) localStorage.setItem("thinkingEffort", newEffort);
});

function handleSend(text) {
  const clean = text.trim();
  if (clean.startsWith("/")) {
    runCommand(clean);
    return;
  }
  const result = queueSend(queue.value, isResponding.value, text);
  queue.value = result.queue;

  if (result.action === "send") {
    sendMessage(result.text);
  }
}

// Local input commands. These never reach the model.
function runCommand(text) {
  const cmd = text.split(/\s+/)[0].toLowerCase();
  if (cmd === "/settings") {
    emit("openSettings");
  } else if (cmd === "/help") {
    messages.value.push({
      sender: "System",
      text: "/settings opens Settings. /help shows this list. /clear clears the chat.",
    });
  } else if (cmd === "/clear") {
    messages.value = [];
  } else {
    messages.value.push({
      sender: "Error",
      text: `Unknown command "${cmd}". Type /help for the list.`,
    });
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
    if (!host) {
      messages.value[thinkingId] = { sender: "Error", text: "No API host set. Open Settings and set the API host." };
      return;
    }
    if (!apiKey) {
      messages.value[thinkingId] = { sender: "Error", text: "No API key set. Open Settings and set the API key." };
      return;
    }
    if (!selectedModel.value) {
      messages.value[thinkingId] = { sender: "Error", text: "No model selected. Pick a model from the list in the top bar." };
      return;
    }
    const result = await window.api.chat(text, selectedModel.value, props.folderPath, host, apiKey, thinkingEffort.value);
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
    window.api.onUsage(({ promptTokens, totalTokens }) => {
      // Total holds prompt plus completion plus think tokens.
      contextTokens.value = totalTokens || promptTokens;
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
    if (models.length === 0) return;
    // Keep the restored model only while the provider still lists it.
    if (!models.includes(selectedModel.value)) {
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
.diff-pane,
.file-pane {
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
