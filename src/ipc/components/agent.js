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
const {
  toolDefinitions,
  toolFunctions,
  readOnlyTools,
  renderPlan,
} = require("@/tools");
const thinkingTexts = require("@/thinking-texts");
const { buildSystemPrompt } = require("@/prompts");
const pendingChanges = require("@/diff-system/pendingChanges");
const compaction = require("@/context-system/compaction");
const { RepeatGuard } = require("./repeatGuard");
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
    // The model's task checklist, set through the updatePlan tool.
    this.plan = [];
    // The guard for the turn in flight, so out-of-band notes can reset it.
    this.guard = null;
  }

  clearHistory() {
    this.history = [];
    this.lastFolderPath = null;
    this.plan = [];
    this.sessionId = randomUUID();
  }

  interrupt() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  }

  // The fields a session file needs to resume this conversation:
  // the API history plus the provider session tag.
  snapshot() {
    return {
      sessionId: this.sessionId,
      history: this.history,
      lastFolderPath: this.lastFolderPath,
      plan: this.plan,
    };
  }

  restore(data) {
    this.sessionId = data.sessionId || randomUUID();
    this.history = Array.isArray(data.history) ? data.history : [];
    this.lastFolderPath = data.lastFolderPath || null;
    this.plan = Array.isArray(data.plan) ? data.plan : [];
  }

  // Append a silent note to the history without calling the model.
  // Used to tell the session about out-of-band events like diff
  // decisions, so the next turn starts with the real state. A decision
  // also changes disk, so the repeat guard forgets earlier reads.
  note(text) {
    this.history.push({ role: "user", content: text });
    if (this.guard) this.guard.reset();
  }

  // The user cleared the plan by hand. The model hears about it on
  // its next turn through the same note channel.
  clearPlan() {
    this.plan = [];
    this.note("[system] The user cleared the task plan. Call updatePlan if the task still needs steps.");
  }

  async handle(
    event,
    { message, model, folderPath, host, apiKey, effort, contextMax, sessionHeader, requestHeader, extraHeaders },
  ) {
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
    const chatConfig = { host, apiKey, sessionId: sid, requestId: rid, effort, sessionHeader, requestHeader, extraHeaders };
    // Setup: timing, token tracking, abort controller
    const startTime = Date.now();
    let totalTokens = 0;
    let reasoningChars = 0;
    // prompt_tokens of the last call drives compaction. Falls back to a
    // character estimate when the provider reports no usage.
    let lastPromptTokens = 0;
    const windowMax = Number(contextMax) || compaction.DEFAULT_CONTEXT_MAX;

    this.currentAbortController = new AbortController();
    const signal = this.currentAbortController.signal;

    const send = (channel, payload) => {
      if (event.sender && event.sender.send) event.sender.send(channel, payload);
    };

    // Renderer communication helpers
    const sendThinking = (text, full) => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      // Usage lands at stream end. Before that, count the live
      // think stream by length so think tokens still show.
      const tokens =
        totalTokens > 0 ? totalTokens : Math.ceil(reasoningChars / 4);
      send("agent:thinking", { text, full, elapsed, tokens });
    };

    const sendToolCall = (tool, args, status, callId) => {
      send("agent:tool", { tool, args, status, callId });
    };

    // Write-tool context: proposeChange registers a pending change and
    // emits its diff card; the tool call returns immediately so the
    // agent keeps working. The write happens later on change:decide.
    const toolCtx = {
      proposeChange: (change) => pendingChanges.propose(event.sender, change),
      findPending: (filePath) => pendingChanges.findByPath(filePath),
      mergeChange: (id, patch) =>
        pendingChanges.update(event.sender, id, patch),
      setPlan: (steps) => {
        this.plan = steps;
        send("agent:plan", { steps });
      },
      signal,
    };

    // Streaming progress callback
    let currentThinkingText = randomThinkingText();

    const onProgress = (progress) => {
      if (progress.reasoning) {
        reasoningChars = progress.reasoning.length;
      }
      if (progress.usage) {
        totalTokens = progress.usage.total_tokens || totalTokens;
        send("agent:usage", {
          promptTokens:
            progress.usage.prompt_tokens ||
            progress.usage.total_tokens ||
            0,
          completionTokens: progress.usage.completion_tokens || 0,
          totalTokens: progress.usage.total_tokens || 0,
        });
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

    const callModel = async (tools) => {
      const reply = await chat(
        this.history,
        model,
        tools ? { tools } : {},
        onProgress,
        signal,
        chatConfig,
      );
      lastPromptTokens =
        (reply.usage && reply.usage.prompt_tokens) ||
        compaction.estimateTokens(this.history);
      return reply;
    };

    // Keep the history inside the context window before the next call.
    // Prune is free; summary costs one tool-less model call.
    const compactIfNeeded = async () => {
      const stage = compaction.compactionStage(lastPromptTokens, windowMax);
      if (stage === "none") return;
      if (stage === "prune") {
        const { history, prunedChars } = compaction.pruneToolResults(this.history);
        this.history = history;
        if (prunedChars > 0) send("agent:note", { text: `[context] pruned ${prunedChars} chars of old tool output` });
        return;
      }
      sendThinking("Compacting context");
      this.history.push({ role: "user", content: compaction.summaryRequest() });
      const summary = await callModel(null);
      this.history = compaction.applySummary(
        this.history,
        summary.content || "(no summary)",
        this.plan.length ? renderPlan(this.plan) : "",
      );
      send("agent:note", { text: "[context] compacted the conversation into a summary" });
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

      sendThinking(currentThinkingText);

      // First AI call
      let reply = await callModel(toolDefinitions);

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
      // other files is legitimate, not a loop. Non-consecutive repeats
      // never halt the loop but get an advisory note when the result
      // is the same as before.
      const guard = new RepeatGuard();
      this.guard = guard;

      while (reply.toolCalls && reply.toolCalls.length > 0) {
        // Interleaved-thinking models need their reasoning echoed back
        // on the tool-call turn or they restart from zero each round.
        const assistantTurn = {
          role: "assistant",
          content: reply.content || "",
          tool_calls: reply.toolCalls,
        };
        if (reply.reasoning) assistantTurn.reasoning_content = reply.reasoning;
        this.history.push(assistantTurn);

        // Show the model's transition line before this tool batch so the
        // chat reads: reasoning -> tools -> reasoning -> tools.
        const noteText = (reply.content || "").trim();
        if (noteText) send("agent:note", { text: noteText });

        // Pass 1: decide, in order, what each call does. Guards depend on
        // sequence, so this stays synchronous.
        // Signatures seen in this batch. A model that emits the same
        // call twice in one response cannot have seen the result, so
        // the copy is skipped instead of run again.
        const batchSignatures = new Set();
        const jobs = reply.toolCalls.map((toolCall) => {
          const toolName = toolCall.function.name;
          const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const signature = `${toolName}\0${toolCall.function.arguments}`;
          let args = {};
          let badJson = false;
          try {
            args = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            badJson = true;
          }
          sendToolCall(toolName, args, "running", callId);

          const job = { toolCall, toolName, args, callId, signature };
          if (halted) {
            job.fixed = "Stopped: the tool loop already halted. Answer with what you have.";
            job.status = "error";
          } else if (badJson) {
            stepCount++;
            job.fixed = "Error: the tool arguments are not valid JSON. Send the call again with valid JSON.";
            job.status = "error";
          } else if (batchSignatures.has(signature)) {
            job.fixed = "Skipped: an identical call already ran in this batch. Use that result.";
            job.status = "done";
          } else {
            batchSignatures.add(signature);
            stepCount++;
            const { dupStreak } = guard.record(signature);
            if (stepCount > MAX_STEPS) {
              job.fixed = `Stopped: step limit of ${MAX_STEPS} reached. Answer with what you have.`;
              job.status = "error";
              halted = true;
            } else if (dupStreak >= 2) {
              job.fixed = `Stopped: ${toolName} was called ${dupStreak + 1} times in a row with identical arguments. The result will not change. Answer with what you have.`;
              job.status = "error";
              halted = true;
            } else if (!toolFunctions[toolName]) {
              job.fixed = JSON.stringify({ ok: false, error: `Unknown tool "${toolName}"` });
              job.status = "error";
            }
          }
          return job;
        });

        // Pass 2: run. Read-only tools run concurrently; write tools and
        // commands run in order so edits to one file stay sequential.
        const runJob = async (job) => {
          if (job.fixed !== undefined) {
            job.result = job.fixed;
            return;
          }
          try {
            job.result = await toolFunctions[job.toolName](job.args, folderPath, toolCtx);
            job.status = "done";
            if (guard.sameAsLast(job.signature, job.result)) {
              job.result +=
                "\n\nNote: this exact call already ran once and returned the same result. Do not repeat it; use this output or different arguments.";
            }
          } catch (err) {
            job.result = JSON.stringify({ ok: false, error: err.message });
            job.status = "error";
          }
        };
        const parallel = jobs.filter(
          (j) => j.fixed === undefined && readOnlyTools.has(j.toolName),
        );
        const serial = jobs.filter((j) => !parallel.includes(j));
        await Promise.all(parallel.map(runJob));
        for (const job of serial) await runJob(job);

        // Pass 3: report and record in the model's order.
        for (const job of jobs) {
          sendToolCall(job.toolName, job.args, job.status, job.callId);
          this.history.push({
            role: "tool",
            content: job.result,
            tool_call_id: job.toolCall.id,
          });
        }

        if (halted) break;

        await compactIfNeeded();

        // Send tool results back to AI
        currentThinkingText = randomThinkingText();
        sendThinking(currentThinkingText);
        reply = await callModel(toolDefinitions);
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
        reply = await callModel(null);
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
      this.guard = null;
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
  note: (text) => defaultSession.note(text),
  clearPlan: () => defaultSession.clearPlan(),
  snapshot: () => defaultSession.snapshot(),
  restore: (data) => defaultSession.restore(data),
};
