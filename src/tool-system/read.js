/**
 * Read-only file tools: readFile and listDirectory.
 */
const fs = require("fs");
const { resolvePath, requireFolder, markFileRead } = require("./shared");

// Lines returned per readFile call when no range is given. Long
// files page through startLine/endLine instead of flooding context.
const MAX_READ_LINES = 400;

/**
 * Read a local file and return its content with line numbers.
 * Optional startLine/endLine page through large files.
 * @param {Object} args - { filePath, startLine, endLine }.
 * @param {string} folderPath - The working directory.
 * @returns {string} The numbered file content plus a range header.
 */
function readFile({ filePath, startLine, endLine }, folderPath) {
  const resolved = resolvePath(filePath, folderPath);
  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    throw new Error(`Path is a directory, not a file: ${resolved}`);
  }
  markFileRead(resolved);

  const lines = fs.readFileSync(resolved, "utf-8").split("\n");
  const total = lines.length;
  const from = Math.max(1, startLine || 1);
  let to = Math.min(total, endLine || total);
  if (!startLine && !endLine && total > MAX_READ_LINES) {
    to = MAX_READ_LINES;
  }

  const numbered = lines
    .slice(from - 1, to)
    .map((text, i) => `${from + i}\t${text}`)
    .join("\n");
  const footer =
    to < total
      ? `\n[${total - to} more lines. Call readFile with startLine=${to + 1} to continue.]`
      : "";
  return `${filePath} — lines ${from}-${to} of ${total}\n${numbered}${footer}`;
}

/**
 * List files and folders in a directory, mimicking ls.
 * Filters hidden files. Sorts folders first, then files alphabetically.
 * @param {string} [dirPath] - The directory to list. Defaults to cwd.
 * @returns {string} JSON array of { name, type } entries.
 */
function listDirectory({ dirPath } = {}, folderPath) {
  requireFolder(folderPath);
  const target = resolvePath(dirPath || ".", folderPath);
  const entries = fs.readdirSync(target, { withFileTypes: true });

  const dirs = [];
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.isDirectory()) {
      dirs.push(entry.name + "/");
    } else {
      files.push(entry.name);
    }
  }

  dirs.sort();
  files.sort();

  return [...dirs, ...files].join("\n");
}

const definitions = [
  {
    type: "function",
    function: {
      name: "readFile",
      description:
        "Read a file and return its content prefixed with line numbers. Long files return the first 400 lines; use startLine/endLine to page further. Never include the line numbers in updateFile oldText or newText.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "The path to the file to read.",
          },
          startLine: {
            type: "integer",
            description: "First line to return, 1-based. Optional.",
          },
          endLine: {
            type: "integer",
            description: "Last line to return, inclusive. Optional.",
          },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "listDirectory",
      description:
        "List the entries of a directory, folders first with a trailing slash. Omit dirPath to list the working directory root.",
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
];

module.exports = { readFile, listDirectory, definitions, MAX_READ_LINES };
