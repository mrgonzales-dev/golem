/**
 * Tool registry.
 *
 * One file per tool group. Each group exports its functions and its
 * OpenAI-style definitions; this index joins them into the two maps
 * the agent loop needs: toolDefinitions (sent to the model) and
 * toolFunctions (name -> implementation). Callers require "@/tools",
 * which re-exports this module.
 */
const shared = require("./shared");
const read = require("./read");
const search = require("./search");
const write = require("./write");
const command = require("./command");
const plan = require("./plan");
const skills = require("./skills");
const pullRequest = require("./pullRequest");

// Tool definitions sent to the AI. invokeSkill joins only when at
// least one skill exists.
const toolDefinitions = [
  ...read.definitions,
  ...search.definitions,
  ...write.definitions,
  ...command.definitions,
  ...plan.definitions,
  ...pullRequest.definitions,
  ...(skills.hasSkills() ? skills.definitions : []),
];

// Map tool names to functions
const toolFunctions = {
  readFile: read.readFile,
  listDirectory: read.listDirectory,
  fileSearch: search.fileSearch,
  fileGrep: search.fileGrep,
  updateFile: write.updateFile,
  writeFile: write.writeFile,
  runCommand: command.runCommand,
  updatePlan: plan.updatePlan,
  proposePullRequest: pullRequest.proposePullRequest,
  invokeSkill: skills.invokeSkill,
};

// Tools that do not change disk or run processes. The agent loop runs
// these concurrently inside one batch.
const readOnlyTools = new Set([
  "readFile",
  "fileSearch",
  "fileGrep",
  "listDirectory",
  "invokeSkill",
  "updatePlan",
  "proposePullRequest",
]);

module.exports = {
  ...toolFunctions,
  toolDefinitions,
  toolFunctions,
  readOnlyTools,
  // Shared helpers other systems need.
  markFileRead: shared.markFileRead,
  serializeReads: shared.serializeReads,
  restoreReads: shared.restoreReads,
  readsFromHistory: shared.readsFromHistory,
  globToRegExp: search.globToRegExp,
  renderPlan: plan.renderPlan,
  PLAN_STATUSES: plan.PLAN_STATUSES,
  listSkillNames: skills.listSkillNames,
  hasSkills: skills.hasSkills,
};
