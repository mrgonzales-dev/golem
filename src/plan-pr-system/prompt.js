/**
 * Plan mode prompt section.
 *
 * buildSystemPrompt injects this section while plan mode is on. The
 * section tells the model to gather requirements instead of writing
 * files, and to stage the result as a pull request. The tool list in
 * toolsSection matches the gated set: read-only tools plus
 * proposePullRequest.
 */
function planModeSection() {
  return [
    "## Plan mode",
    "- You are in plan mode. Read code and ask the user questions. Do not edit files or run commands.",
    "- When the plan is clear, or the user says done, call proposePullRequest with a short title and the plan as the description.",
    "- The pull request is a plan bundle the user reviews on the Pull Requests page. It is not applied code.",
    "- To revise an existing pull request, call proposePullRequest again with its prId.",
  ].join("\n");
}

module.exports = { planModeSection };
