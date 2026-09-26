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
      :prsOpen="prOpen"
      :prCount="prs.length"
      :contextUsed="contextTokens"
      :contextMax="contextMax"
      @toggleDiff="emit('update:diffOpen', !diffOpen)"
      @togglePrs="togglePrs"
    />
    <div class="chat-row">
      <TerminalPanel
        v-show="terminalVisible && terminalDock === 'chat'"
        class="terminal-pane"
        :folderPath="folderPath"
        :visible="terminalVisible"
        :engaged="terminalVisible && terminalDock === 'chat'"
        :dock="terminalDock"
        @toggleDock="emit('toggleDock')"
        @close="emit('closeTerminal')"
      />
      <template v-if="!(terminalVisible && terminalDock === 'chat')">
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
      <PrPage
        v-else-if="prOpen"
        class="pr-pane"
        :prs="prs"
        @close="prOpen = false"
        @implement="implementPr"
        @send="sendPrToAgent"
        @remove="removePr"
      />
      <ChatBox
        v-else
        class="chat-pane"
        :messages="messages"
        :queue="queue"
        :isResponding="isResponding"
        :plan="plan"
        :planMode="planMode"
        @createPr="createPrNow"
        @sendQueue="flushQueue"
        @focusInput="messageInput?.focus()"
        @taskClick="onTaskClick"
        @clearPlan="clearPlan"
      />
      </template>
    </div>
    <QuickPromptActionToolBar v-if="!chatHiddenByTerminal" @send="handleSend" />
    <MessageInput
      v-if="!chatHiddenByTerminal"
      ref="messageInput"
      :busy="isResponding"
      :modelName="selectedModel"
      :effort="thinkingEffort"
      :effortOptions="effortOptions"
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
import TerminalPanel from "../Terminal/TerminalPanel.vue";
import DiffBox from "./components/diffPanel/DiffBox.vue";
import MessageInput from "./components/MessageInput.vue";
import CodeViewer from "./components/filePane/CodeViewer.vue";
import PrPage from "./components/prPanel/PrPage.vue";
import QuickPromptActionToolBar from "./components/QuickPromptActionToolBar.vue";
import { applyToolCall } from "./partials/toolCalls";
import { shouldFlush, dequeue, handleSend as queueSend } from "./partials/agentQueue";
import { getProviderConfig } from "../Settings/partials/providerConfig";
import { runCommand, isCommand } from "@/commands/commands";
import { scheduleSessionSave } from "@/session-system/sessionSync";

const props = defineProps({
  models: { type: Array, default: () => [] },
  modelContextMap: { type: Object, default: () => ({}) },
  modelMetaMap: { type: Object, default: () => ({}) },
  folderPath: { type: String, default: "" },
  diffOpen: { type: Boolean, default: false },
  pendingChanges: { type: Array, default: () => [] },
  viewingFile: { type: String, default: "" },
  terminalVisible: { type: Boolean, default: false },
  terminalDock: { type: String, default: "chat" },
});

const emit = defineEmits([
  "update:diffOpen",
  "update:pendingChanges",
  "update:viewingFile",
  "openSettings",
  "decideAll",
  "toggleDock",
  "closeTerminal",
]);

const chatHiddenByTerminal = computed(
  () => props.terminalVisible && props.terminalDock === "chat",
);

const messages = ref([]);
const queue = ref([]);
const messageInput = ref(null);
const isResponding = ref(false);
// The agent's task plan from the updatePlan tool. Shown in the
// tasks pane inside the chat box; persisted with the session.
const plan = ref([]);
// The turn in flight, so events that arrive outside sendMessage
// (change cards) can insert above the live thinking slot.
let activeTurn = null;
// Pull request summaries, fed by the agent:pr event and refreshed
// from main each time the page opens.
const prs = ref([]);
const prOpen = ref(false);
// Plan mode sends only read-only tools plus proposePullRequest to the
// model. /plan toggles it; a created pull request ends it.
const planMode = ref(false);
// Restored from localStorage; validated against the fetched model
// list in the watcher below so a stale name falls back to models[0].
const selectedModel = ref(localStorage.getItem("selectedModel") || "");
// Thinking effort sent as reasoning_effort. Default omits the field.
const thinkingEffort = ref(localStorage.getItem("thinkingEffort") || "default");

const pendingCount = computed(
  () => props.pendingChanges.filter((c) => c.status === "pending").length,
);

// Context meter: prompt_tokens of the last request approximates the
// full conversation size. Max comes from the provider report or the
// models.dev catalog; 1M is only the fallback when both stay silent.
const contextTokens = ref(0);

const contextMax = computed(
  () => props.modelContextMap[selectedModel.value] || 1000000,
);

// Effort options follow the model's catalog entry. reasoning:false
// leaves only Default; unknown models keep the permissive default and
// the chat retry strips the field if the provider rejects it.
const effortOptions = computed(() => {
  const meta = props.modelMetaMap[selectedModel.value];
  if (!meta) return ["default", "low", "medium", "high"];
  if (meta.reasoning === false) return ["default"];
  return ["default", ...(meta.efforts.length ? meta.efforts : ["low", "medium", "high"])];
});

// Falls back to the first listed effort — "default" keeps the choice safe
// when the model changes or the catalog lacks the saved value.
watch(
  effortOptions,
  (options) => {
    if (!options.includes(thinkingEffort.value)) {
      thinkingEffort.value = options[0];
    }
  },
  { immediate: true },
);

watch(selectedModel, (newModel) => {
  if (newModel) localStorage.setItem("selectedModel", newModel);
});

watch(thinkingEffort, (newEffort) => {
  if (newEffort) localStorage.setItem("thinkingEffort", newEffort);
});

function handleSend(text) {
  if (isCommand(text)) {
    runCommand(text, {
      pushMessage: pushNotice,
      pushError,
      openSettings: () => emit("openSettings"),
      clearChat: () => (messages.value = []),
      togglePlanMode: () => {
        planMode.value = !planMode.value;
        pushNotice(
          planMode.value
            ? "Plan mode on. The agent asks questions and cannot write files. Type /plan to exit."
            : "Plan mode off.",
        );
      },
    });
    return;
  }
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

// Local-only notice in the chat list. No model call — the session
// already hears the decision through the change:decide history note.
function pushNotice(text) {
  messages.value.push({ sender: "System", text });
}

function pushError(text) {
  messages.value.push({ sender: "Error", text });
}

// Hydrates the card from a session:latest payload. Only the
// display layer — the real history was already restored in main.
function restoreSession(session) {
  if (Array.isArray(session.messages)) messages.value = session.messages;
  if (session.selectedModel) selectedModel.value = session.selectedModel;
  if (session.thinkingEffort) thinkingEffort.value = session.thinkingEffort;
  plan.value = Array.isArray(session.plan) ? session.plan : [];
  prs.value = Array.isArray(session.prs) ? session.prs : [];
}

// A clicked task becomes a blue chip in the input so the user can
// refer to it in the next message.
function onTaskClick(step, index) {
  messageInput.value?.insertTaskChip?.(step, index);
}

// Manual clear from the pane header. Main clears its copy and notes
// it in the history so the model does not keep a phantom plan.
async function clearPlan() {
  plan.value = [];
  if (window.api?.clearPlan) await window.api.clearPlan();
  requestSave();
}

// Insert a settled message above the live thinking slot while a turn
// runs, or at the end when the agent is idle.
function insertMessage(msg) {
  if (activeTurn && messages.value[activeTurn.thinkingId]?.sender === "Thinking") {
    messages.value.splice(activeTurn.thinkingId, 0, msg);
    activeTurn.thinkingId++;
  } else {
    messages.value.push(msg);
  }
}

// Debounced session persist. Main merges this display state with
// AgentSession history and pendingChanges before writing.
function requestSave() {
  scheduleSessionSave(() => ({
    messages: messages.value,
    folderPath: props.folderPath,
    selectedModel: selectedModel.value,
    thinkingEffort: thinkingEffort.value,
  }));
}

async function togglePrs() {
  prOpen.value = !prOpen.value;
  if (prOpen.value) {
    // The pane chain shows one view at a time — close the others.
    emit("update:diffOpen", false);
    emit("update:viewingFile", "");
  }
  if (prOpen.value && window.api.prList) {
    const res = await window.api.prList();
    if (res?.ok) prs.value = res.prs;
  }
}

// Implement hands the plan back to the agent as a work order. The
// normal write tools turn it into pending changes for review.
function implementPr(id) {
  const pr = prs.value.find((p) => p.id === id);
  if (!pr) return;
  sendSystemMessage(
    `Implement pull request ${id} "${pr.title}". ${pr.description} Produce the file changes as proposals now.`,
  );
  window.api.prSetStatus?.(id, "implemented");
  prs.value = prs.value.map((p) =>
    p.id === id ? { ...p, status: "implemented" } : p,
  );
}

// Send to Agent re-opens the plan for revision. The model updates the
// same pull request through proposePullRequest's prId parameter.
function sendPrToAgent(id) {
  const pr = prs.value.find((p) => p.id === id);
  if (!pr) return;
  sendSystemMessage(
    `Revise pull request ${id} "${pr.title}". Ask me what to change, then update it with the proposePullRequest tool using prId "${id}".`,
  );
}

async function removePr(id) {
  await window.api.prRemove?.(id);
  prs.value = prs.value.filter((p) => p.id !== id);
}

// The Create Pull Request button tells the agent to stage the plan;
// the proposePullRequest tool does the real work.
function createPrNow() {
  sendSystemMessage(
    "The plan is ready. Create the pull request now with the proposePullRequest tool.",
  );
}

defineExpose({ sendSystemMessage, pushNotice, restoreSession, requestSave });

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

  const turn = { thinkingId: messages.value.length };
  activeTurn = turn;
  messages.value.push({ sender: "Thinking", text: "Thinking", elapsed: 0, tokens: 0 });

  let stopThinkingListener = null;
  let stopToolListener = null;
  let stopNoteListener = null;

  const handleThinking = (data) => {
    if (messages.value[turn.thinkingId]?.sender !== "Thinking") return;
    messages.value[turn.thinkingId] = {
      sender: "Thinking",
      text: data.text,
      full: data.full,
      elapsed: data.elapsed,
      tokens: data.tokens,
    };
  };

  const handleToolCall = (data) => {
    const result = applyToolCall(messages.value, turn.thinkingId, data);
    messages.value = result.messages;
    turn.thinkingId = result.thinkingId;
  };

  // The model's transition sentence between tool rounds. Settled text,
  // inserted above the live thinking slot so the trace stays ordered.
  const handleNote = (data) => {
    insertMessage({ sender: "Reason", text: data.text });
  };

  if (window.api.onThinking) {
    stopThinkingListener = window.api.onThinking(handleThinking);
  }
  if (window.api.onToolCall) {
    stopToolListener = window.api.onToolCall(handleToolCall);
  }
  if (window.api.onNote) {
    stopNoteListener = window.api.onNote(handleNote);
  }

  try {
    const { host, apiKey, sessionHeader, requestHeader, extraHeaders } =
      getProviderConfig();
    if (!host) {
      messages.value[turn.thinkingId] = { sender: "Error", text: "No API host set. Open Settings and set the API host." };
      return;
    }
    if (!apiKey) {
      messages.value[turn.thinkingId] = { sender: "Error", text: "No API key set. Open Settings and set the API key." };
      return;
    }
    if (!selectedModel.value) {
      messages.value[turn.thinkingId] = { sender: "Error", text: "No model selected. Pick a model from the list in the top bar." };
      return;
    }
    // Real window only. An unknown model sends 0 so main applies its
    // own conservative default instead of the 1M meter fallback.
    const knownMax = props.modelContextMap[selectedModel.value] || 0;
    const result = await window.api.chat(
      text,
      selectedModel.value,
      props.folderPath,
      host,
      apiKey,
      thinkingEffort.value,
      knownMax,
      { sessionHeader, requestHeader, extraHeaders, planMode: planMode.value },
    );
    if (result.ok) {
      messages.value[turn.thinkingId] = { sender: "AI", text: result.reply };
    } else if (result.error === "Interrupted") {
      messages.value[turn.thinkingId] = { sender: "Interrupted", text: "Interrupted" };
    } else {
      messages.value[turn.thinkingId] = { sender: "Error", text: result.error };
    }
  } catch (err) {
    messages.value[turn.thinkingId] = { sender: "Error", text: err.message };
  } finally {
    if (stopThinkingListener) stopThinkingListener();
    if (stopToolListener) stopToolListener();
    if (stopNoteListener) stopNoteListener();
    if (activeTurn === turn) activeTurn = null;
    isResponding.value = false;
    requestSave();
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
      const known = props.pendingChanges.some((c) => c.id === data.id);
      const next = known
        ? props.pendingChanges.map((c) => (c.id === data.id ? data : c))
        : [...props.pendingChanges, data];
      emit("update:pendingChanges", next);
      // Preview the diff in the chat where the agent proposed it. The
      // user opens the Diff pane by hand to approve; no redirect.
      const idx = messages.value.findIndex(
        (m) => m.sender === "Change" && m.change?.id === data.id,
      );
      if (idx >= 0) messages.value[idx] = { sender: "Change", change: data };
      else insertMessage({ sender: "Change", change: data });
      requestSave();
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
      // The chat preview keeps its own copy; sync its status too.
      messages.value = messages.value.map((m) =>
        m.sender === "Change" && m.change?.id === id
          ? { ...m, change: { ...m.change, status } }
          : m,
      );
      requestSave();
    });
  }
  if (window.api.onPlan) {
    window.api.onPlan(({ steps }) => {
      plan.value = Array.isArray(steps) ? steps : [];
      requestSave();
    });
  }
  if (window.api.onPr) {
    window.api.onPr((pr) => {
      // Same event covers create and revise — upsert on id.
      const known = prs.value.some((p) => p.id === pr.id);
      prs.value = known
        ? prs.value.map((p) => (p.id === pr.id ? { ...p, ...pr } : p))
        : [pr, ...prs.value];
      // A created pull request ends plan mode on its own.
      planMode.value = false;
      requestSave();
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
.file-pane,
.pr-pane,
.terminal-pane {
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
