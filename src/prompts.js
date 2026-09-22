/**
 * System prompt sections for the agent.
 *
 * Each section is its own function so new guidance can be added or
 * swapped without touching the rest. buildSystemPrompt assembles the
 * sections in order; AgentSession rebuilds it when the working folder
 * changes.
 *
 * @param {string} folderPath - The current working directory, or "".
 * @returns {string} The system prompt text.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { listSkillNames } = require("@/tools");

// Caps for the project map. The map must stay a small fixed cost per
// session, not a second copy of the repo.
const MAP_MAX_ENTRIES = 40;
const MAP_DOC_MAX_CHARS = 3000;
const MAP_GIT_MAX_LINES = 30;

function introSection() {
  return "You are G-CODE, an agentic coding assistant. You help engineers plan and build software.";
}

function environmentSection(folderPath) {
  return [
    "## Environment",
    `Working directory: ${folderPath || "not set"}`,
    `Platform: ${process.platform}. ${process.platform === "win32" ? "runCommand uses cmd.exe; use Windows-compatible commands and quoting." : "runCommand uses /bin/sh."}`,
    folderPath
      ? "Relative tool paths resolve against the working directory. fileSearch and fileGrep default to it."
      : "No working directory is set. Do not call tools that need a path. Ask the user to select a folder.",
  ].join("\n");
}

/**
 * Top-level entries of the folder, folders first with a trailing slash.
 * @param {string} folderPath - The working directory.
 * @returns {string[]} The entry names, capped.
 */
function topLevelEntries(folderPath) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });
  const dirs = [];
  const files = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    (e.isDirectory() ? dirs : files).push(e.isDirectory() ? `${e.name}/` : e.name);
  }
  dirs.sort();
  files.sort();
  const all = [...dirs, ...files];
  if (all.length > MAP_MAX_ENTRIES) {
    return [...all.slice(0, MAP_MAX_ENTRIES), `... ${all.length - MAP_MAX_ENTRIES} more`];
  }
  return all;
}

/**
 * The head of the first project guide found: AGENTS.md, then
 * CLAUDE.md, then README.md.
 * @param {string} folderPath - The working directory.
 * @returns {{ name: string, text: string }|null} The doc, or null.
 */
function projectDoc(folderPath) {
  for (const name of ["AGENTS.md", "CLAUDE.md", "README.md"]) {
    const file = path.join(folderPath, name);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, "utf-8");
    const text =
      raw.length > MAP_DOC_MAX_CHARS
        ? raw.slice(0, MAP_DOC_MAX_CHARS) + `\n... [${name} truncated; readFile for the rest]`
        : raw;
    return { name, text: text.trim() };
  }
  return null;
}

/**
 * Detect the toolchain from manifest files and list the commands the
 * model should use to verify its work.
 * @param {string} folderPath - The working directory.
 * @returns {string[]} Lines such as "npm test (package.json scripts.test)".
 */
function toolchainHints(folderPath) {
  const hints = [];
  const has = (name) => fs.existsSync(path.join(folderPath, name));

  if (has("package.json")) {
    let scripts = {};
    try {
      scripts = JSON.parse(fs.readFileSync(path.join(folderPath, "package.json"), "utf-8")).scripts || {};
    } catch {}
    const pm = has("pnpm-lock.yaml") ? "pnpm" : has("yarn.lock") ? "yarn" : has("bun.lockb") || has("bun.lock") ? "bun" : "npm";
    hints.push(`Package manager: ${pm}.`);
    for (const key of ["test", "lint", "typecheck", "build", "dev"]) {
      if (scripts[key]) hints.push(`${pm} run ${key} -> ${scripts[key]}`);
    }
  }
  if (has("composer.json")) {
    hints.push("PHP project (composer.json). Tests: vendor/bin/phpunit.");
  }
  if (has("Cargo.toml")) hints.push("Rust project. Tests: cargo test. Lint: cargo clippy.");
  if (has("go.mod")) hints.push("Go project. Tests: go test ./... . Lint: go vet ./... .");
  if (has("pyproject.toml") || has("requirements.txt")) {
    hints.push("Python project. Tests: pytest.");
  }
  if (has("Makefile")) hints.push("Makefile present. Check its targets before you invent commands.");
  return hints;
}

/**
 * Short git status, or null when the folder is not a repo.
 * @param {string} folderPath - The working directory.
 * @returns {string[]|null} Status lines, capped.
 */
function gitStatus(folderPath) {
  try {
    const out = execFileSync("git", ["status", "--short", "--branch"], {
      cwd: folderPath,
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (!out) return null;
    const lines = out.split("\n");
    if (lines.length > MAP_GIT_MAX_LINES) {
      return [...lines.slice(0, MAP_GIT_MAX_LINES), `... ${lines.length - MAP_GIT_MAX_LINES} more`];
    }
    return lines;
  } catch {
    return null;
  }
}

/**
 * A compact map of the project so the model does not spend its first
 * tool calls on discovery. Every part is optional and capped.
 * @param {string} folderPath - The working directory, or "".
 * @returns {string} The section, or "" when no folder is set.
 */
function projectSection(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) return "";
  const lines = [
    "## Project map",
    "Snapshot taken when the folder was opened. Use tools for the current state.",
  ];
  try {
    lines.push("", "Top level:", ...topLevelEntries(folderPath).map((e) => `- ${e}`));
  } catch {}
  const hints = toolchainHints(folderPath);
  if (hints.length) lines.push("", "Toolchain:", ...hints.map((h) => `- ${h}`));
  const git = gitStatus(folderPath);
  if (git) lines.push("", "Git status:", ...git.map((l) => `  ${l}`));
  const doc = projectDoc(folderPath);
  if (doc) {
    lines.push("", `${doc.name} (project rules; follow them):`, doc.text);
  }
  return lines.join("\n");
}

function reasoningSection() {
  return [
    "## Reasoning",
    "- Sort the task first. Trivial: a lookup, a one-line edit, a direct question. Non-trivial: anything else.",
    "- Trivial task: act at once. Do not plan.",
    "- Non-trivial task: plan before you act. Name the files you must read. State your hypothesis. Then call updatePlan with the steps and start.",
    "- Read every file that the change touches before you edit. Trace callers and callees. Do not guess at code you have not seen.",
    "- Form a hypothesis, then verify it against the real code before you act on it. If the code disagrees, the code wins.",
    "- When something fails, diagnose the cause before you try another approach. Do not repeat a failed action with small variations.",
    "- Before each tool batch, write one short sentence: what you learned and what you do next. That line is shown to the user. Keep it under 15 words.",
    "- After edits, mark the plan step done and verify with the project's test or lint command when one exists.",
  ].join("\n");
}

function toolsSection() {
  const skills = listSkillNames();
  const lines = [
    "## Tools",
    "- Tools: readFile, fileSearch, fileGrep, listDirectory, updateFile, writeFile, runCommand, updatePlan" +
      (skills.length ? ", invokeSkill." : "."),
    "- Write your one-line reason and the tool calls in the same response. Never stop to wait.",
    "- Batch independent tool calls in one response. Read-only calls in one batch run concurrently.",
    "- Prefer dedicated tools over runCommand shell equivalents (readFile over cat, fileGrep over grep, fileSearch over find).",
    "- runCommand is for builds, tests, git, and real shell work only. Pass timeoutSeconds for long test suites.",
    "- Never repeat a call with identical arguments. Reuse the earlier result.",
    "- ok:false is a failure. Do not retry the same call.",
    "- If a search returns nothing, try one different query, then move on or state what is missing.",
    "- Stop calling tools and answer as soon as you have enough information.",
  ];
  if (skills.length) {
    lines.push(
      `- Skills hold step-by-step playbooks: ${skills.join(", ")}. Call invokeSkill with the name when a task matches one. Follow the playbook.`,
    );
  }
  return lines.join("\n");
}

function editRulesSection() {
  return [
    "## Edit rules",
    "- Call readFile on a file before updateFile or writeFile on it.",
    "- readFile output has line numbers. Never include them in oldText or newText.",
    "- Proposed changes are NOT on disk until the user approves them. Do not re-read a file expecting your edit.",
    "- [system] notes in the conversation report diff approvals, rejections, and context compaction. Trust them.",
  ].join("\n");
}

function doingTasksSection() {
  return [
    "## Doing tasks",
    "- Make the smallest change that works. Reuse existing code and deps; do not rewrite what exists.",
    "- Mimic the codebase's style, names, and patterns. No comments unless asked.",
    "- Fix root causes, not symptoms. If an approach fails, diagnose why before switching tactics.",
    "- Never run destructive commands (rm -rf, git reset --hard, dropping data) without asking first.",
    "- Verify changes with the project's lint/typecheck/test commands when they exist.",
    "- Never commit unless the user asks.",
    "- Report faithfully: say what failed, what you did not verify, and what actually passed.",
  ].join("\n");
}

function outputSection() {
  return [
    "## Output",
    "- Be brief and precise. Answer in 1-4 lines when you can. Use more when the task needs an explanation or a list.",
    "- No preamble, no recap of what you did, no filler.",
    "- Reference code as file_path:line_number.",
  ].join("\n");
}

function buildSystemPrompt(folderPath) {
  return [
    introSection(),
    environmentSection(folderPath),
    projectSection(folderPath),
    reasoningSection(),
    toolsSection(),
    editRulesSection(),
    doingTasksSection(),
    outputSection(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

module.exports = {
  buildSystemPrompt,
  introSection,
  environmentSection,
  projectSection,
  topLevelEntries,
  projectDoc,
  toolchainHints,
  gitStatus,
  reasoningSection,
  toolsSection,
  editRulesSection,
  doingTasksSection,
  outputSection,
};
