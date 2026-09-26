<template>
  <div v-if="open" class="settings-overlay" @click.self="$emit('close')">
    <div class="settings-modal">
      <div class="settings-header">
        <span class="settings-title">Settings</span>
        <button class="settings-close" @click="$emit('close')">&times;</button>
      </div>
      <div class="settings-body">
        <div class="settings-group">
          <label class="settings-label">API Host</label>
          <input
            v-model="host"
            type="text"
            class="settings-input"
            placeholder="http://localhost:1234"
          />
        </div>
        <div class="settings-group">
          <label class="settings-label">API Key</label>
          <div class="settings-input-row">
            <input
              v-model="apiKey"
              :type="showApiKey ? 'text' : 'password'"
              class="settings-input"
              placeholder="Enter your API key"
              @input="apiKey = apiKey.replace(/\s/g, '')"
            />
            <button
              type="button"
              class="settings-eye-btn"
              @click="showApiKey = !showApiKey"
            >
              {{ showApiKey ? "&#128065;&#8205;&#128488;" : "&#128065;" }}
            </button>
          </div>
        </div>
        <div class="settings-group">
          <label class="settings-label">Session header (empty = off)</label>
          <input
            v-model="sessionHeader"
            type="text"
            class="settings-input"
            placeholder="x-opencode-session"
          />
        </div>
        <div class="settings-group">
          <label class="settings-label">Request header (empty = off)</label>
          <input
            v-model="requestHeader"
            type="text"
            class="settings-input"
            placeholder="x-opencode-request"
          />
        </div>
        <div class="settings-group">
          <label class="settings-label">Extra headers (Name: value per line)</label>
          <textarea
            v-model="extraHeaders"
            class="settings-input"
            rows="3"
            placeholder="X-Custom-Header: some-value"
          ></textarea>
        </div>
        <div class="settings-test-row">
          <button class="settings-test-btn" @click="testConnection" :disabled="testing">
            {{ testing ? "Testing..." : "Test Connection" }}
          </button>
          <span v-if="testResult" class="settings-test-status" :class="testResultClass">
            {{ testResult }}
          </span>
        </div>
      </div>
      <div class="settings-footer">
        <button class="settings-save-btn" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { getProviderConfig, saveProviderConfig } from "./partials/providerConfig";

const props = defineProps({
  open: { type: Boolean, default: false },
});

const emit = defineEmits(["close", "saved"]);

const host = ref("");
const apiKey = ref("");
const sessionHeader = ref("x-opencode-session");
const requestHeader = ref("x-opencode-request");
const extraHeaders = ref("");
const showApiKey = ref(false);
const testing = ref(false);
const testResult = ref("");
const testResultClass = ref("");

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      const config = getProviderConfig();
      host.value = config.host;
      apiKey.value = config.apiKey;
      sessionHeader.value = config.sessionHeader;
      requestHeader.value = config.requestHeader;
      extraHeaders.value = config.extraHeaders;
      testResult.value = "";
      testResultClass.value = "";
    }
  },
);

async function testConnection() {
  if (!host.value || !apiKey.value) {
    testResult.value = "Host and API key are required.";
    testResultClass.value = "test-fail";
    return;
  }

  testing.value = true;
  testResult.value = "";
  testResultClass.value = "";

  try {
    const result = await window.api.testConnection(host.value, apiKey.value);
    if (result.ok) {
      testResult.value = `Connected. ${result.modelCount} models available.`;
      testResultClass.value = "test-pass";
    } else {
      testResult.value = result.error;
      testResultClass.value = "test-fail";
    }
  } catch (err) {
    testResult.value = err.message;
    testResultClass.value = "test-fail";
  }

  testing.value = false;
}

function save() {
  saveProviderConfig(
    host.value,
    apiKey.value,
    sessionHeader.value,
    requestHeader.value,
    extraHeaders.value,
  );
  emit("saved");
  emit("close");
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.settings-modal {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  display: flex;
  flex-direction: column;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}

.settings-title {
  font-size: 14px;
  color: var(--text);
}

.settings-close {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.settings-close:hover {
  color: var(--text);
}

.settings-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.settings-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.settings-input {
  background-color: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  user-select: text;
}

.settings-input:focus {
  border-color: var(--accent);
}

.settings-test-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-test-btn {
  background-color: var(--bg-tertiary);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.settings-test-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.settings-test-btn:hover:not(:disabled) {
  border-color: var(--accent);
}

.settings-test-status {
  font-size: 12px;
}

.test-pass {
  color: var(--success);
}

.test-fail {
  color: var(--danger);
}

.settings-input-row {
  display: flex;
  align-items: stretch;
  gap: 0;
}

.settings-input-row .settings-input {
  flex: 1;
  border-radius: 4px 0 0 4px;
}

.settings-eye-btn {
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  border-left: none;
  border-radius: 0 4px 4px 0;
  padding: 0 8px;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}

.settings-eye-btn:hover {
  color: var(--text);
}

.settings-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
}

.settings-save-btn {
  background-color: var(--accent);
  color: var(--bg);
  border: none;
  border-radius: 4px;
  padding: 6px 16px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}

.settings-save-btn:hover {
  background-color: var(--accent-hover);
}
</style>
