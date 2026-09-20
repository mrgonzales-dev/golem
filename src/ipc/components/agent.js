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
const { buildSystemPrompt } = require("@/prompts");
const pendingChanges = require("@/diff-system/pendingChanges");
const { randomUUID } = require("crypto");

function randomThinkingText() {
  return thinkingTexts[Math.floor(Math.random() * thinkingTexts.length)];
}

class AgentSession {
  constructor() {
    this.history = [];
    this.currentAbortController = null;
    this.lastFolderPath = null;
    // Stable id per conversation. Go routes and caches by it.
    this.sessionId = randomUUID();
  }

  clearHistory() {
    this.history = [];
    this.lastFolderPath = null;
    this.sessionId = randomUUID();
  }

  interrupt() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  // Append a silent note to the history without calling the model.
  // Used to tell the session about out-of-band events like diff
  // decisions, so the next turn starts with the real state.
  note(text) {
    this.history.push({ role: "user", content: text });
  }

  async handle(event, { message, model, folderPath, host, apiKey, effort }) {
    if (!host) {
      return {
        ok: false,
        error: "No API host set. Open Settings and set the API host.",
      };
    }
    if (!apiKey) {
      return {
        ok: false,
        error: "No API key set. Open Settings and set the API key.",
      };
    }
    if (!model) {
      return {
        ok: false,
        error: "No model selected. Pick a model from the list in the top bar.",
      };
    }
    // Tag stays stable per run like opencode sessions. Each send
    // mints only a fresh request id, mirroring x-opencode-request.
    const sid = this.sessionId;
    const rid = randomUUID();
    // Setup: timing, token tracking, abort controller
    const startTime = Date.now();
    let totalTokens = 0;
    let reasoningChars = 0;

    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    // Renderer communication helpers
    const sendThinking = (text, full) => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      // Usage lands at stream end. Before that, count the live
      // think stream by length so think tokens still show.
      const tokens =
        totalTokens > 0 ? totalTokens : Math.ceil(reasoningChars / 4);
      if (event.sender && event.sender.send) {
        event.sender.send("agent:thinking", { text, full, elapsed, tokens });
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

        this.history.unshift({
          role: "system",
          content: buildSystemPrompt(folderPath || ""),
        });
        this.lastFolderPath = currentFolderPath;
      }

      // Add user message to history
      this.history.push({ role: "user", content: message });

      // Streaming progress callback
      let currentThinkingText = randomThinkingText();

      const onProgress = (progress) => {
        if (progress.reasoning) {
          reasoningChars = progress.reasoning.length;
        }
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
        sendThinking(
          tail ? tail.slice(0, 80) : currentThinkingText,
          progress.reasoning || null,
        );
      };

      sendThinking(currentThinkingText);

      // First AI call
      let reply = await chat(
        this.history,
        model,
        { tools: toolDefinitions },
        onProgress,
        signal,
        { host, apiKey, sessionId: sid, requestId: rid, effort },
      );

      // Tool-call loop: execute tools, feed results back to AI.
      // Guardrails: hard step limit, and an advisory-then-trip guard on
      // identical calls (same tool + same arguments). Synthetic tool
      // results keep the history valid when we halt mid-batch.
      // 25 was too low for multi-file tasks — a single review easily
      // reads 20+ files. GOLEM_MAX_STEPS overrides for testing.
      const MAX_STEPS = Number(process.env.GOLEM_MAX_STEPS) || 250;
      let stepCount = 0;
      let halted = false;
      // Consecutive identical calls only. A different call between two
      // identical calls resets the streak — a re-read after exploring
      // other files is legitimate, not a loop.
      let lastSignature = null;
      let dupStreak = 0;
      // Lifetime counts per signature. Non-consecutive repeats never
      // halt the loop but get an advisory note on the second sighting.
      const lifetimeCounts = new Map();

      while (reply.toolCalls && reply.toolCalls.length > 0) {
        this.history.push({
          role: "assistant",
          content: reply.content || "",
          tool_calls: reply.toolCalls,
        });

        // Show the model's transition line before this tool batch so the
        // chat reads: reasoning -> tools -> reasoning -> tools.
        const noteText = (reply.content || "").trim();
        if (noteText && event.sender && event.sender.send) {
          event.sender.send("agent:note", { text: noteText });
        }

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
            result =
              "Stopped: the tool loop already halted. Answer with what you have.";
            sendToolCall(toolName, args, "error", callId);
          } else if (batchSignatures.has(signature)) {
            result =
              "Skipped: an identical call already ran in this batch. Use that result.";
            sendToolCall(toolName, args, "done", callId);
          } else {
            batchSignatures.add(signature);
            stepCount++;
            dupStreak = signature === lastSignature ? dupStreak + 1 : 0;
            lastSignature = signature;
            const lifetimeCount = (lifetimeCounts.get(signature) || 0) + 1;
            lifetimeCounts.set(signature, lifetimeCount);

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
                  if (dupStreak === 1 || lifetimeCount === 2) {
                    result +=
                      "\n\nNote: this exact call already ran once and returned the same result. Do not repeat it; use this output or different arguments.";
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
          { host, apiKey, sessionId: sid, requestId: rid, effort },
        );
      }

      // On a halted loop, give the model one tool-less call to turn
      // its findings into an answer instead of leaving an empty reply.
      if (halted) {
        this.history.push({
          role: "user",
          content:
            "Tool use is stopped. Summarize what you found and answer now without calling tools.",
        });
        sendThinking("Summarizing findings");
        reply = await chat(this.history, model, {}, onProgress, signal, {
          host,
          apiKey,
          sessionId: sid,
          requestId: rid,
          effort,
        });
      }

      // Finalize: store assistant reply and return
      let finalReply = reply.content || "";
      if (halted) {
        finalReply +=
          (finalReply ? "\n\n" : "") +
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
  note: (text) => defaultSession.note(text),
};
