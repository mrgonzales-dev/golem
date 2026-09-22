/**
 * Context compaction for the agent loop.
 *
 * The conversation history grows with every tool result. Two stages
 * keep it inside the model's context window:
 *
 *   1. prune  - replace old, large tool outputs with a one-line stub
 *               and drop old reasoning_content. Cheap, no model call.
 *   2. summary - ask the model for a summary of the work so far and
 *                restart the history from it. Costs one model call.
 *
 * All functions here are pure. They do not mutate their inputs. The
 * agent loop decides when to call them from the prompt_tokens the
 * provider reports after each call.
 */

// Fraction of the context window that triggers each stage.
const PRUNE_RATIO = 0.7;
const SUMMARY_RATIO = 0.85;

// Fallback window when the catalog does not know the model.
const DEFAULT_CONTEXT_MAX = 128000;

// Tool rounds kept intact at the tail. The model still needs its most
// recent reads to write oldText for updateFile.
const KEEP_ROUNDS = 4;

// Tool outputs shorter than this stay as they are; the stub would not
// save anything.
const MIN_PRUNE_CHARS = 300;

/**
 * Rough token count for a history when the provider reports none.
 * @param {object[]} history - The API message history.
 * @returns {number} The estimated token count.
 */
function estimateTokens(history) {
  let chars = 0;
  for (const msg of history || []) {
    chars += JSON.stringify(msg).length;
  }
  return Math.ceil(chars / 4);
}

/**
 * Decide the compaction stage for the next call.
 * @param {number} promptTokens - Tokens of the last request, or an estimate.
 * @param {number} contextMax - The model's context window.
 * @returns {"none"|"prune"|"summary"} The stage to run.
 */
function compactionStage(promptTokens, contextMax) {
  const max = contextMax > 0 ? contextMax : DEFAULT_CONTEXT_MAX;
  if (!promptTokens || promptTokens <= 0) return "none";
  const ratio = promptTokens / max;
  if (ratio >= SUMMARY_RATIO) return "summary";
  if (ratio >= PRUNE_RATIO) return "prune";
  return "none";
}

/**
 * Replace old tool outputs with stubs and drop old reasoning.
 * The last keepRounds tool rounds stay untouched.
 * @param {object[]} history - The API message history.
 * @param {object} [options] - { keepRounds, minChars }.
 * @returns {{ history: object[], prunedChars: number }} The new history.
 */
function pruneToolResults(history, options = {}) {
  const keepRounds = options.keepRounds ?? KEEP_ROUNDS;
  const minChars = options.minChars ?? MIN_PRUNE_CHARS;

  const roundStarts = [];
  history.forEach((msg, i) => {
    if (msg.role === "assistant" && Array.isArray(msg.tool_calls)) {
      roundStarts.push(i);
    }
  });
  if (roundStarts.length <= keepRounds) {
    return { history, prunedChars: 0 };
  }
  const cutoff = roundStarts[roundStarts.length - keepRounds];

  // tool_call_id -> tool name, so the stub can say which tool it was.
  const toolNames = new Map();
  for (const msg of history) {
    if (msg.role !== "assistant" || !Array.isArray(msg.tool_calls)) continue;
    for (const call of msg.tool_calls) {
      toolNames.set(call.id, call.function?.name || "tool");
    }
  }

  let prunedChars = 0;
  const out = history.map((msg, i) => {
    if (i >= cutoff) return msg;
    if (msg.role === "tool" && typeof msg.content === "string") {
      if (msg.content.length <= minChars) return msg;
      if (msg.content.startsWith("[") && msg.content.includes("output pruned")) {
        return msg;
      }
      prunedChars += msg.content.length;
      const name = toolNames.get(msg.tool_call_id) || "tool";
      return {
        ...msg,
        content: `[${name} output pruned: ${msg.content.length} chars. Call the tool again if you need it.]`,
      };
    }
    if (msg.role === "assistant" && msg.reasoning_content) {
      prunedChars += msg.reasoning_content.length;
      const { reasoning_content, ...rest } = msg;
      return rest;
    }
    return msg;
  });
  return { history: out, prunedChars };
}

/**
 * The instruction sent to the model to produce the summary.
 * @returns {string} The user message text.
 */
function summaryRequest() {
  return [
    "The context window is nearly full. Write a handoff summary so the work can continue from it alone.",
    "Include: the user's goal, the decisions made, the files read and what matters in each, the changes proposed and their approval state, what failed, and the exact next step.",
    "Use file paths and line numbers. Do not call tools. Do not add filler.",
  ].join(" ");
}

/**
 * Build the compacted history from a summary.
 * Keeps the system prompt, then one note that carries the summary and
 * the current plan, then a nudge to continue.
 * @param {object[]} history - The old API message history.
 * @param {string} summaryText - The model's summary.
 * @param {string} [planText] - The rendered plan, if any.
 * @returns {object[]} The new history.
 */
function applySummary(history, summaryText, planText) {
  const system = history.find((m) => m.role === "system");
  const parts = [
    "[system] Older context was compacted. Summary of the conversation so far:",
    summaryText.trim(),
  ];
  if (planText) parts.push("", "Current plan:", planText);
  parts.push(
    "",
    "Continue the task from this summary. Re-read a file before you edit it.",
  );
  const out = [];
  if (system) out.push(system);
  out.push({ role: "user", content: parts.join("\n") });
  return out;
}

module.exports = {
  PRUNE_RATIO,
  SUMMARY_RATIO,
  DEFAULT_CONTEXT_MAX,
  KEEP_ROUNDS,
  estimateTokens,
  compactionStage,
  pruneToolResults,
  summaryRequest,
  applySummary,
};
