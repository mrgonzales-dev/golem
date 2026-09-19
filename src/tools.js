const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { FileFinder } = require("@ff-labs/fff-node");
const { hunkForEdit, lineDiff } = require("./diff-system/diff");

let finder = null;

// Tracks files read via readFile: path -> { mtimeMs }. Write tools
// refuse to touch a file the model has not read, and the approval
// path re-checks the mtime to catch changes made while pending.
const readTracker = new Map();

/**
 * Record a file as read/current after a read or an applied write.
 * @param {string} resolved - The absolute file path.
 */
function markFileRead(resolved) {
  readTracker.set(resolved, { mtimeMs: fs.statSync(resolved).mtimeMs });
}

const skillsDir = path.join(__dirname, "default_skills");

function resolvePath(p, folderPath) {
  if (!p) return p;
  if (path.isAbsolute(p)) return p;
  if (folderPath) return path.resolve(folderPath, p);
  return path.resolve(p);
}

function requireFolder(folderPath) {
  if (!folderPath) {
    throw new Error(
      "No folder selected. Ask the user to select a folder first.",
    );
  }
}

function fileSearch({ query, basePath }, folderPath) {
  requireFolder(folderPath);
  if (finder) finder.destroy();

  const resolvedBase = resolvePath(basePath, folderPath);
  const result = FileFinder.create({ basePath: resolvedBase, aiMode: true });
  if (!result.ok) throw new Error(result.error);

  finder = result.value;
  return finder.fileSearch(query, { pageSize: 20 });
}

function fileGrep({ query, basePath }, folderPath) {
  requireFolder(folderPath);
  if (finder) finder.destroy();

  const resolvedBase = resolvePath(basePath, folderPath);
  const result = FileFinder.create({ basePath: resolvedBase, aiMode: true });
  if (!result.ok) throw new Error(result.error);

  finder = result.value;
  const hits = finder.grep(query, {
    mode: "plain",
    smartCase: true,
    beforeContext: 1,
    afterContext: 1,
    classifyDefinitions: true,
  });
  return hits;
}

/**
 * Propose overwriting or creating a file. The content is staged in
 * memory and only written when the user approves the diff card.
 * @param {Object} args - { filePath, content }.
 * @param {string} folderPath - The working directory.
 * @param {Object} ctx - { proposeChange, findPending, mergeChange } from the agent loop.
 * @returns {string} The tool result text for the model.
 */
function writeFile({ filePath, content } = {}, folderPath, ctx) {
  requireFolder(folderPath);
  const resolved = resolvePath(filePath, folderPath);

  const exists = fs.existsSync(resolved);
  let hunks;
  if (exists) {
    if (!readTracker.has(resolved)) {
      throw new Error(
        "File has not been read yet. Read it first before overwriting it.",
      );
    }
    const oldContent = fs.readFileSync(resolved, "utf-8");
    hunks = [{ startLine: 1, lines: lineDiff(oldContent, content) }];
  } else {
    hunks = [
      {
        startLine: 1,
        lines: content.split("\n").map((text) => ({ type: "add", text })),
      },
    ];
  }

  const existing = ctx.findPending ? ctx.findPending(resolved) : null;
  if (existing) {
    ctx.mergeChange(existing.id, { hunks, stagedContent: content });
    return `Pending change ${existing.id} for ${filePath} replaced with the new full content. Still queued for user review and NOT written yet.`;
  }

  const stagedMtime = exists ? fs.statSync(resolved).mtimeMs : null;
  const id = ctx.proposeChange({
    filePath: resolved,
    tool: "writeFile",
    hunks,
    stagedContent: content,
    stagedMtime,
  });
  return `Change ${id} proposed for ${filePath}. It is queued for user review and NOT written yet. Continue with other work; do not assume it exists on disk.`;
}

/**
 * Propose an exact string replacement in a file. The edit is staged
 * in memory and only written when the user approves the diff card.
 * @param {Object} args - { filePath, oldText, newText, replaceAll }.
 * @param {string} folderPath - The working directory.
 * @param {Object} ctx - { proposeChange, findPending, mergeChange } from the agent loop.
 * @returns {string} The tool result text for the model.
 */
function updateFile({ filePath, oldText, newText, replaceAll } = {}, folderPath, ctx) {
  requireFolder(folderPath);
  const resolved = resolvePath(filePath, folderPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `File does not exist: ${resolved}. Use writeFile to create it.`,
    );
  }
  if (!readTracker.has(resolved)) {
    throw new Error(
      "File has not been read yet. Read it first before updating it.",
    );
  }
  if (!oldText) {
    throw new Error("oldText must not be empty. Use writeFile to set full content.");
  }
  if (oldText === newText) {
    throw new Error("No changes to make: oldText and newText are identical.");
  }

  // A pending change for this file is the new base: the edit applies
  // on top of the staged content so one file holds one proposal.
  const existing = ctx.findPending ? ctx.findPending(resolved) : null;
  const content = existing
    ? existing.stagedContent
    : fs.readFileSync(resolved, "utf-8");

  const matches = content.split(oldText).length - 1;
  if (matches === 0) {
    throw new Error(
      existing
        ? `String to replace not found in ${resolved}. The file has a pending change; base oldText on the staged content or use writeFile.`
        : `String to replace not found in ${resolved}.`,
    );
  }
  if (matches > 1 && !replaceAll) {
    throw new Error(
      `Found ${matches} matches of oldText. Provide more context to make it unique, or set replaceAll to true.`,
    );
  }

  const updated = replaceAll
    ? content.split(oldText).join(newText)
    : content.replace(oldText, () => newText);

  const matchIndices = [];
  let idx = -1;
  while ((idx = content.indexOf(oldText, idx + 1)) !== -1) {
    matchIndices.push(idx);
  }
  const hunks = matchIndices
    .slice(0, 20)
    .map((i) => hunkForEdit(content, i, oldText, newText));

  if (existing) {
    ctx.mergeChange(existing.id, {
      hunks: [...existing.hunks, ...hunks],
      stagedContent: updated,
    });
    return `Edits merged into pending change ${existing.id} for ${filePath}. Still queued for user review and NOT written yet.`;
  }

  const stagedMtime = fs.statSync(resolved).mtimeMs;
  const id = ctx.proposeChange({
    filePath: resolved,
    tool: "updateFile",
    hunks,
    stagedContent: updated,
    stagedMtime,
  });
  return `Change ${id} proposed for ${filePath}. It is queued for user review and NOT written yet. Continue with other work; do not assume it exists on disk.`;
}

/**
 * Read a local file and return its content as text.
 * @param {string} filePath - The path to the file to read.
 * @returns {string} The file content.
 */
function readFile({ filePath }, folderPath) {
  const resolved = resolvePath(filePath, folderPath);
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${resolved}`);
  }
  markFileRead(resolved);
  return fs.readFileSync(resolved, "utf-8");
}

/**
 * List available skills or invoke a specific skill by name.
 * When no skillName is given, returns a list of skills with descriptions.
 * When skillName is given, returns the full skill markdown content.
 * @param {Object} args - The arguments.
 * @param {string} [args.skillName] - The name of the skill to invoke.
 * @returns {string} The skill list or skill content.
 */
function invokeSkill({ skillName } = {}) {
  if (!fs.existsSync(skillsDir)) {
    return "Skills are empty";
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  const skillFolders = entries.filter((e) => e.isDirectory());

  if (skillFolders.length === 0) {
    return "Skills are empty";
  }

  if (!skillName) {
    const skills = [];
    for (const folder of skillFolders) {
      const skillFile = path.join(skillsDir, folder.name, "skill.md");
      if (!fs.existsSync(skillFile)) continue;

      const raw = fs.readFileSync(skillFile, "utf-8");
      const descMatch = raw.match(/^description:\s*(.+)$/m);
      const whenMatch = raw.match(/^when_to_use:\s*(.+)$/m);

      skills.push({
        name: folder.name,
        description: descMatch ? descMatch[1].trim() : "No description",
        when_to_use: whenMatch ? whenMatch[1].trim() : "No usage info",
      });
    }

    if (skills.length === 0) {
      return "Skills are empty";
    }

    return JSON.stringify(skills, null, 2);
  }

  const skillFile = path.join(skillsDir, skillName, "skill.md");
  if (!fs.existsSync(skillFile)) {
    return `Error: Skill "${skillName}" not found`;
  }

  return fs.readFileSync(skillFile, "utf-8");
}

/**
 * Format a list of changes as a unified diff string.
 * @param {Object} args - The diff arguments.
 * @param {string} args.file - The file name to show in the diff header.
 * @param {Array<{type: "add"|"remove"|"keep", text: string}>} args.changes - The list of changes.
 * @returns {string} The unified diff string.
 */
function writeDiff(args) {}

/**
 * Fetch a web page URL and return its text content with HTML stripped.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string>} The page text content.
 */
async function webFetch(url) {}

/**
 * Remove HTML tags, scripts, and styles from an HTML string.
 * @param {string} html - The raw HTML string.
 * @returns {string} The cleaned text.
 */
function stripHtml(html) {}

/**
 * Check if the skills directory has any skill folders with skill.md files.
 * @returns {boolean} True if at least one skill is available.
 */
function hasSkills() {
  if (!fs.existsSync(skillsDir)) return false;
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  return entries.some(
    (e) =>
      e.isDirectory() &&
      fs.existsSync(path.join(skillsDir, e.name, "skill.md")),
  );
}

/**
 * List files and folders in a directory, mimicking ls.
 * Filters hidden files. Sorts folders first, then files alphabetically.
 * @param {string} [dirPath] - The directory to list. Defaults to cwd.
 * @returns {string} JSON array of { name, type } entries.
 */
function listDirectory({ dirPath } = {}, folderPath) {
  if (!dirPath) {
    throw new Error(
      "No directory path provided. Ask the user to select a folder first.",
    );
  }
  const target = resolvePath(dirPath, folderPath);
  const entries = fs.readdirSync(target, { withFileTypes: true });

  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      dirs.push({ name: entry.name, type: "dir" });
    } else {
      files.push({ name: entry.name, type: "file" });
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return JSON.stringify([...dirs, ...files], null, 2);
}

// Tool definitions sent to the AI
const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "readFile",
      description: "Read a local file and return its content as text.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to read.",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fileSearch",
      description: "Search for files by name with fuzzy matching.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
          basePath: {
            type: "string",
            description: "The base directory to search.",
          },
        },
        required: ["query", "basePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fileGrep",
      description: "Search file contents for a pattern.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The content search query." },
          basePath: {
            type: "string",
            description: "The base directory to search.",
          },
        },
        required: ["query", "basePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listDirectory",
      description:
        "List files and folders in a directory. Returns entries with type (dir/file), folders first. Filters hidden files. Requires a dirPath — do not call without one.",
      parameters: {
        type: "object",
        properties: {
          dirPath: {
            type: "string",
            description:
              "The directory path to list. Relative paths resolve against the working directory.",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "updateFile",
      description:
        "Propose an exact string replacement in a file. The change is shown to the user for approval and only written if approved. The file must be read with readFile first. oldText must match exactly once unless replaceAll is true. Multiple updates to the same file merge into one pending change.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to update.",
          },
          oldText: {
            type: "string",
            description: "The exact text to replace.",
          },
          newText: {
            type: "string",
            description: "The replacement text.",
          },
          replaceAll: {
            type: "boolean",
            description:
              "Replace every occurrence of oldText. Default false.",
          },
        },
        required: ["filePath", "oldText", "newText"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "writeFile",
      description:
        "Propose creating a new file or overwriting an existing file with the given content. Shown to the user for approval before writing. Overwriting an existing file requires reading it with readFile first.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to write.",
          },
          content: {
            type: "string",
            description: "The full content to write.",
          },
        },
        required: ["filePath", "content"],
      },
    },
  },
];

// Only include invokeSkill if skills are available
if (hasSkills()) {
  toolDefinitions.push({
    type: "function",
    function: {
      name: "invokeSkill",
      description:
        "List available skills with descriptions, or invoke a specific skill by name to get its full content. Call without skillName to see available skills. Call with skillName to get the skill's markdown content.",
      parameters: {
        type: "object",
        properties: {
          skillName: {
            type: "string",
            description:
              "The name of the skill to invoke. Omit to list all available skills.",
          },
        },
        required: [],
      },
    },
  });
}

// Map tool names to functions
const toolFunctions = {
  readFile,
  fileSearch,
  fileGrep,
  invokeSkill,
  listDirectory,
  updateFile,
  writeFile,
};

module.exports = {
  readFile,
  fileSearch,
  fileGrep,
  invokeSkill,
  listDirectory,
  updateFile,
  writeFile,
  writeDiff,
  webFetch,
  markFileRead,
  toolDefinitions,
  toolFunctions,
  hasSkills,
};
