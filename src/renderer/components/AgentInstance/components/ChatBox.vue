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
-->
<template>
  <div class="div1" id="chat-box" @click="handleClick">
    <div ref="chatScroll" class="chat-scroll" @scroll="handleScroll">
      <template v-for="(msg, i) in messages" :key="i">
        <UserMessage v-if="msg.sender === 'You'" :text="msg.text" />
        <AgentReply v-else-if="msg.sender === 'AI'" :text="msg.text" />
        <ThinkingReply
          v-else-if="msg.sender === 'Thinking'"
          :text="msg.text"
          :elapsed="msg.elapsed"
          :tokens="msg.tokens"
        />
        <AgentToolCall
          v-else-if="msg.sender === 'Tool'"
          :tool="msg.tool"
          :items="msg.items"
        />
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
    <QueueBar
      :queue="queue"
      :isResponding="isResponding"
      @sendQueue="$emit('sendQueue')"
      @interrupt="$emit('interrupt')"
    />
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";
import UserMessage from "./UserMessage.vue";
import AgentReply from "./AgentReply.vue";
import ThinkingReply from "./agentReply/ThinkingReply.vue";
import AgentToolCall from "./agentReply/AgentToolCall.vue";
import AgentError from "./agentReply/AgentError.vue";
import QueueBar from "./QueueBar.vue";

const props = defineProps({
  messages: { type: Array, default: () => [] },
  queue: { type: Array, default: () => [] },
  isResponding: { type: Boolean, default: false },
});

const emit = defineEmits(["sendQueue", "interrupt", "focusInput"]);

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

.chat-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.div1 :deep(*) {
  user-select: text;
}
</style>
