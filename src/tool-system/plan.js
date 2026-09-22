/**
 * updatePlan: the model's task checklist. The session keeps the plan,
 * the renderer shows it in the tasks pane, and compaction carries it
 * into the summary so the model keeps its place on long tasks.
 */

const PLAN_STATUSES = ["pending", "in_progress", "done", "verified"];
const PLAN_STATUS_SET = new Set(PLAN_STATUSES);

/**
 * Render a plan as a numbered checklist for the model and the user.
 * @param {Array<{text: string, status: string}>} steps - The plan steps.
 * @returns {string} One line per step with a status marker.
 */
function renderPlan(steps) {
  if (!steps || steps.length === 0) return "(no tasks)";
  const marks = {
    pending: "[ ]",
    in_progress: "[>]",
    done: "[x]",
    verified: "[v]",
  };
  return steps
    .map((s, i) => `${i + 1}. ${marks[s.status] || "[ ]"} ${s.text}`)
    .join("\n");
}

/**
 * Replace the task plan. An empty list clears the plan.
 * @param {Object} args - { steps: [{ text, status }] }.
 * @param {string} folderPath - Unused.
 * @param {Object} ctx - { setPlan } from the agent loop.
 * @returns {string} The rendered plan.
 */
function updatePlan({ steps } = {}, folderPath, ctx = {}) {
  if (!Array.isArray(steps)) {
    throw new Error("steps must be an array of { text, status }. Send [] to clear the plan.");
  }
  if (steps.length === 0) {
    if (ctx.setPlan) ctx.setPlan([]);
    return "Plan cleared.";
  }
  const clean = steps.map((s, i) => {
    const text = typeof s === "string" ? s : s && s.text;
    if (!text || !String(text).trim()) {
      throw new Error(`Step ${i + 1} has no text.`);
    }
    const status = s && PLAN_STATUS_SET.has(s.status) ? s.status : "pending";
    return { text: String(text).trim(), status };
  });
  if (ctx.setPlan) ctx.setPlan(clean);
  return `Plan updated:\n${renderPlan(clean)}`;
}

const definitions = [
  {
    type: "function",
    function: {
      name: "updatePlan",
      description:
        "Set or replace your task plan as a short checklist. Call it at the start of any task that needs more than three tool calls, and again whenever a step changes status. Send the full list each time; send [] to clear it. Mark a step verified after you double-check it. The plan is shown to the user and kept when older context is trimmed.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "The full ordered list of steps. Empty clears the plan.",
            items: {
              type: "object",
              properties: {
                text: {
                  type: "string",
                  description: "One short step, under 12 words.",
                },
                status: {
                  type: "string",
                  enum: PLAN_STATUSES,
                  description:
                    "Step status. Keep one step in_progress. verified means done and double-checked.",
                },
              },
              required: ["text", "status"],
            },
          },
        },
        required: ["steps"],
      },
    },
  },
];

module.exports = { updatePlan, renderPlan, PLAN_STATUSES, definitions };
