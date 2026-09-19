/**
 * IPC handler for agent chat requests.
 * Receives a message and model from the renderer, sends them to the AI API,
 * and returns the AI reply.
 *
 * AgentSession encapsulates conversation history and abort controller
 * as instance state, enabling multiple independent agent sessions.
 *
 * @param {string} message - The user message to send to the AI.
 * @param {string} model - The model ID to use for the request.
 * @returns {Promise<{ok: boolean, reply?: string, error?: string}>}
 */
const { chat } = require("@/ai-bridge");
const { toolDefinitions, toolFunctions } = require("@/tools");
const thinkingTexts = require("@/thinking-texts");
const pendingChanges = require("@/diff-system/pendingChanges");

function randomThinkingText() {
  return thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)];
}

class AgentSession {
  constructor() {
    this.history = [];
    this.currentAbortController = null;
    this.lastFolderPath = null;
  }

  clearHistory() {
    this.history = [];
    this.lastFolderPath = null;
  }

  interrupt() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  async handle(event, { message, model, folderPath, host, apiKey }) {
    // Setup: timing, token tracking, abort controller
    const startTime = Date.now();
    let totalTokens = 0;

    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    // Renderer communication helpers
    const sendThinking = (text) => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const tokens = totalTokens;
      if (event.sender && event.sender.send) {
        event.sender.send("agent:thinking", { text, elapsed, tokens });
      }
    };

    const sendToolCall = (tool, args, status, callId) => {
      if (event.sender && event.sender.send) {
        event.sender.send("agent:tool", { tool, args, status, callId });
      }
    };

    // Write-tool context: proposeChange registers a pending change and
    // emits its diff card; the tool call returns immediately so the
    // agent keeps working. The write happens later on change:decide.
    const toolCtx = {
      proposeChange: (change) => pendingChanges.propose(event.sender, change),
      findPending: (filePath) => pendingChanges.findByPath(filePath),
      mergeChange: (id, patch) =>
        pendingChanges.update(event.sender, id, patch),
    };

    try {
      // System prompt: rebuild when folderPath changes
      const currentFolderPath = folderPath || "";
      if (this.lastFolderPath !== currentFolderPath) {
        // Remove old system prompt if it exists
        if (this.history.length > 0 && this.history[0].role === "system") {
          this.history.shift();
        }

        const systemPrompt = JSON.stringify({
          role: "You are an agentic coding assistant. You help engineers plan and build software.",
          system_setup: {
            working_directory: folderPath || "not set",
            instructions: folderPath
              ? `Use the working directory (${folderPath}) as basePath when calling fileSearch or fileGrep. Relative paths in readFile and listDirectory resolve against this directory.`
              : "No working directory is set. Do not call any tools that need a path. Ask the user to select a folder first.",
          },
          rules: [
            "Never call a tool with the same arguments twice; reuse the earlier result.",
            "Stop calling tools and answer as soon as you have enough information.",
            "If a search returns nothing, try one different query, then move on or state what is missing.",
            "A tool result with ok:false is a failure; do not retry the same call.",
          ],
        });

        this.history.unshift({
          role: "system",
          content: systemPrompt,
        });
        this.lastFolderPath = currentFolderPath;
      }

      // Add user message to history
      this.history.push({ role: "user", content: message });

      // Streaming progress callback
      let currentThinkingText = randomThinkingText();

      const onProgress = (progress) => {
        if (progress.usage) {
          totalTokens = progress.usage.total_tokens || totalTokens;
          if (event.sender && event.sender.send) {
            event.sender.send("agent:usage", {
              promptTokens:
                progress.usage.prompt_tokens ||
                progress.usage.total_tokens ||
                0,
              completionTokens: progress.usage.completion_tokens || 0,
              totalTokens: progress.usage.total_tokens || 0,
            });
          }
        }
        // If the model streams reasoning, show its latest line instead
        // of the canned thinking text.
        const tail = progress.reasoning
          ?.split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .pop();
        sendThinking(tail ? tail.slice(0, 80) : currentThinkingText);
      };

      sendThinking(currentThinkingText);

      // First AI call
      let reply = await chat(
        this.history,
        model,
        { tools: toolDefinitions },
        onProgress,
        signal,
        { host, apiKey },
      );

      // Tool-call loop: execute tools, feed results back to AI.
      // Guardrails: hard step limit, and an advisory-then-trip guard on
      // identical calls (same tool + same arguments). Synthetic tool
      // results keep the history valid when we halt mid-batch.
      const MAX_STEPS = 25;
      let stepCount = 0;
      let halted = false;
      // Consecutive identical calls only. A different call between two
      // identical calls resets the streak — a re-read after exploring
      // other files is legitimate, not a loop.
      let lastSignature = null;
      let dupStreak = 0;

      while (reply.toolCalls && reply.toolCalls.length > 0) {
        this.history.push({
          role: "assistant",
          content: reply.content || "",
          tool_calls: reply.toolCalls,
        });

        // Signatures seen in this batch. A model that emits the same
        // call twice in one response cannot have seen the result, so
        // the copy is skipped instead of run again.
        const batchSignatures = new Set();

        // Execute each tool call
        for (const toolCall of reply.toolCalls) {
          const toolName = toolCall.function.name;
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {}

          const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          sendToolCall(toolName, args, "running", callId);

          let result;
          const signature = `${toolName}\0${toolCall.function.arguments}`;
          if (halted) {
            result = "Stopped: the tool loop already halted. Answer with what you have.";
            sendToolCall(toolName, args, "error", callId);
          } else if (batchSignatures.has(signature)) {
            result = "Skipped: an identical call already ran in this batch. Use that result.";
            sendToolCall(toolName, args, "done", callId);
          } else {
            batchSignatures.add(signature);
            stepCount++;
            dupStreak = signature === lastSignature ? dupStreak + 1 : 0;
            lastSignature = signature;

            if (stepCount > MAX_STEPS) {
              result = `Stopped: step limit of ${MAX_STEPS} reached. Answer with what you have.`;
              sendToolCall(toolName, args, "error", callId);
              halted = true;
            } else if (dupStreak >= 2) {
              result = `Stopped: ${toolName} was called ${dupStreak + 1} times in a row with identical arguments. The result will not change. Answer with what you have.`;
              sendToolCall(toolName, args, "error", callId);
              halted = true;
            } else {
              const fn = toolFunctions[toolName];
              if (fn) {
                try {
                  result = await fn(args, folderPath, toolCtx);
                  if (dupStreak === 1) {
                    result += "\n\nNote: this exact call already ran once and returned the same result. Do not repeat it; use this output or different arguments.";
                  }
                  sendToolCall(toolName, args, "done", callId);
                } catch (err) {
                  result = JSON.stringify({ ok: false, error: err.message });
                  sendToolCall(toolName, args, "error", callId);
                }
              } else {
                result = JSON.stringify({
                  ok: false,
                  error: `Unknown tool "${toolName}"`,
                });
                sendToolCall(toolName, args, "error", callId);
              }
            }
          }

          // Add tool result to history
          this.history.push({
            role: "tool",
            content: result,
            tool_call_id: toolCall.id,
          });
        }

        if (halted) break;

        // Send tool results back to AI
        currentThinkingText = randomThinkingText();
        sendThinking(currentThinkingText);
        reply = await chat(
          this.history,
          model,
          { tools: toolDefinitions },
          onProgress,
          signal,
          { host, apiKey },
        );
      }

      // Finalize: store assistant reply and return
      let finalReply = reply.content || "";
      if (halted) {
        finalReply += (finalReply ? "\n\n" : "") +
          "[Stopped: the tool loop hit the step limit or repeated identical calls.]";
      }
      this.history.push({ role: "assistant", content: finalReply });

      return { ok: true, reply: finalReply, usage: reply.usage };

      // Error handling: abort vs generic failure
    } catch (err) {
      if (err.message === "Aborted" || err.message === "canceled") {
        return { ok: false, error: "Interrupted" };
      }
      return { ok: false, error: err.message };
    } finally {
      this.currentAbortController = null;
    }
  }
}

// Default singleton for backward compatibility with the IPC registry
const defaultSession = new AgentSession();

module.exports = {
  AgentSession,
  name: "agent",
  handler: (event, args) => defaultSession.handle(event, args),
  interrupt: () => defaultSession.interrupt(),
  clearHistory: () => defaultSession.clearHistory(),
};
