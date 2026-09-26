<!--
  ChatBox.vue
  Renders the message list. Loops over the messages array and picks
  the correct component for each message based on the `sender` field.

  Props:
    - messages: Array of message objects. Each object has a `sender`
      field that decides which component renders it.

  Sender to component mapping:
    - "You"         → UserMessage
    - "AI"          → AgentReply
    - "Thinking"    → ThinkingReply
    - "Tool"        → AgentToolCall (grouped by tool type)
    - "Error"       → AgentError (type: error)
    - "Interrupted"  → AgentError (type: interrupted)
    - "Change"      → DiffCard (read-only preview of a proposed edit)

  The tasks pane (right, 20%) shows the agent's plan while it has
  steps. Clicking a task emits taskClick so the parent can drop a
  chip into the input.
-->
<template>
  <div class="div1" id="chat-box" @click="handleClick">
    <div class="chat-row">
      <div ref="chatScroll" class="chat-scroll" @scroll="handleScroll">
        <template v-for="(msg, i) in messages" :key="i">
          <UserMessage v-if="msg.sender === 'You'" :text="msg.text" />
          <AgentReply v-else-if="msg.sender === 'AI'" :text="msg.text" />
          <ThinkingReply
            v-else-if="msg.sender === 'Thinking'"
            :text="msg.text"
            :full="msg.full"
            :elapsed="msg.elapsed"
            :tokens="msg.tokens"
          />
          <ReasoningLine
            v-else-if="msg.sender === 'Reason'"
            :text="msg.text"
          />
          <AgentToolCall
            v-else-if="msg.sender === 'Tool'"
            :tool="msg.tool"
            :items="msg.items"
          />
          <div v-else-if="msg.sender === 'Change' && msg.change" class="chat-change">
            <DiffCard :change="msg.change" />
          </div>
          <AgentError
            v-else-if="msg.sender === 'Interrupted'"
            :text="msg.text"
            type="interrupted"
          />
          <AgentError
            v-else-if="msg.sender === 'Error'"
            :text="msg.text"
            type="error"
          />
          <AgentError
            v-else-if="msg.sender === 'System'"
            :text="msg.text"
            type="notice"
          />
        </template>
      </div>
      <TasksPane
        v-if="plan.length > 0"
        class="tasks-side"
        :steps="plan"
        @taskClick="(step, i) => $emit('taskClick', step, i)"
        @clear="$emit('clearPlan')"
      />
    </div>
    <QueueBar
      :queue="queue"
      :isResponding="isResponding"
      @sendQueue="$emit('sendQueue')"
      @interrupt="$emit('interrupt')"
    />
    <PlanBar :planMode="planMode" @createPr="$emit('createPr')" />
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from "vue";
import UserMessage from "./UserMessage.vue";
import AgentReply from "./AgentReply.vue";
import ThinkingReply from "./agentReply/ThinkingReply.vue";
import ReasoningLine from "./agentReply/ReasoningLine.vue";
import AgentToolCall from "./agentReply/AgentToolCall.vue";
import AgentError from "./agentReply/AgentError.vue";
import QueueBar from "./QueueBar.vue";
import PlanBar from "./PlanBar.vue";
import DiffCard from "./diffPanel/DiffCard.vue";
import TasksPane from "./tasksPane/TasksPane.vue";

const props = defineProps({
  messages: { type: Array, default: () => [] },
  queue: { type: Array, default: () => [] },
  isResponding: { type: Boolean, default: false },
  plan: { type: Array, default: () => [] },
  planMode: { type: Boolean, default: false },
});

const emit = defineEmits([
  "sendQueue",
  "interrupt",
  "focusInput",
  "taskClick",
  "clearPlan",
  "createPr",
]);

// Focus the input on click, but leave text selection and clicks on
// links or buttons alone.
function handleClick(event) {
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) return;
  if (event.target.closest("a, button, textarea, input")) return;
  emit("focusInput");
}

const chatScroll = ref(null);
const isAtBottom = ref(true);

function isScrolledToBottom() {
  const el = chatScroll.value;
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 30;
}

function handleScroll() {
  isAtBottom.value = isScrolledToBottom();
}

function scrollToBottom() {
  const el = chatScroll.value;
  if (!el) return;
  el.scrollTop = el.scrollHeight;
}

onMounted(() => {
  nextTick(scrollToBottom);
});

watch(
  () => props.messages.length,
  () => {
    if (isAtBottom.value) {
      nextTick(scrollToBottom);
    }
  }
);

watch(
  () => props.messages,
  () => {
    if (isAtBottom.value) {
      nextTick(scrollToBottom);
    }
  },
  { deep: true }
);
</script>

<style scoped>
.div1 {
  display: flex;
  flex-direction: column;
}

.chat-row {
  display: flex;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.chat-scroll {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.tasks-side {
  flex: 0 0 20%;
  max-width: 20%;
}

.chat-change {
  padding: 4px 8px;
}

.div1 :deep(*) {
  user-select: text;
}
</style>
