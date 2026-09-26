/**
 * proposePullRequest: stage a pull request from plan mode.
 * The pull request lands on the pull requests page; Implement turns
 * it into real change proposals through the normal write tools.
 */

function proposePullRequest({ title, description, prId } = {}, folderPath, ctx = {}) {
  if (!ctx.proposePr) {
    throw new Error("Pull requests are not available in this session.");
  }
  const id = ctx.proposePr({ title, description, prId });
  return prId
    ? `Pull request ${id} updated. It is waiting for user review on the Pull Requests page.`
    : `Pull request ${id} created. It is waiting for user review on the Pull Requests page; nothing is implemented yet.`;
}

const definitions = [
  {
    type: "function",
    function: {
      name: "proposePullRequest",
      description:
        "Create or update a pull request from the current plan. In plan mode, ask the user questions first, then call this when the plan is ready or the user says done. Pass prId to revise an existing pull request. The user reviews it on the Pull Requests page and decides what happens next. Do not use it to edit files.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Short pull request title.",
          },
          description: {
            type: "string",
            description: "The plan body: goal, steps, files to touch.",
          },
          prId: {
            type: "string",
            description:
              "Update this pull request instead of creating a new one.",
          },
        },
        required: ["title", "description"],
      },
    },
  },
];

module.exports = { proposePullRequest, definitions };
