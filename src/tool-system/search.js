/**
 * Search tools backed by fff-node: fileSearch (names) and fileGrep
 * (contents). One cached FileFinder per basePath.
 */
const { FileFinder } = require("@ff-labs/fff-node");
const { resolvePath, requireFolder, clampResults } = require("./shared");

// The native scan is async, so the first search must await
// waitForScan before the index has any files.
let finder = null;
let finderBase = null;
let scanReady = null;

async function getFinder(basePath, folderPath) {
  const resolvedBase = resolvePath(basePath, folderPath);
  if (finder && finderBase === resolvedBase && !finder.isDestroyed) {
    await scanReady;
    return finder;
  }
  if (finder) finder.destroy();

  const result = FileFinder.create({ basePath: resolvedBase, aiMode: true });
  if (!result.ok) throw new Error(result.error);

  finder = result.value;
  finderBase = resolvedBase;
  scanReady = finder.waitForScan(15000);
  await scanReady;
  return finder;
}

// Result caps. A wide query must not flood the context window; the
// footer tells the model to narrow the query instead.
const SEARCH_DEFAULT = 20;
const SEARCH_MAX = 100;
const GREP_DEFAULT = 50;
const GREP_MAX = 200;

/**
 * Convert a glob such as "src/**\/*.vue" or "*.{js,ts}" to a RegExp.
 * Electron's Node lacks path.matchesGlob, so this covers the common
 * forms: *, **, ?, and {a,b} alternation. Matches the relative path.
 */
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") i++;
        re += "(?:.*/)?";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else if (c === "{") re += "(?:";
    else if (c === "}") re += ")";
    else if (c === ",") re += "|";
    else re += c.replace(/[.+^$()|[\]\\]/g, "\\$&");
  }
  // A bare "*.js" also matches nested files, like ripgrep's --glob.
  const anchored = glob.includes("/") ? `^${re}$` : `(?:^|/)${re}$`;
  return new RegExp(anchored);
}

async function fileSearch({ query, basePath, maxResults }, folderPath) {
  requireFolder(folderPath);
  const f = await getFinder(basePath || folderPath, folderPath);
  const pageSize = clampResults(maxResults, SEARCH_DEFAULT, SEARCH_MAX);
  const result = f.fileSearch(query, { pageSize });
  if (!result.ok) throw new Error(result.error);

  const paths = result.value.items.map((item) => item.relativePath);
  const total = result.value.totalMatched;
  const out = { totalMatched: total, paths };
  if (total > paths.length) {
    out.note = `Showing ${paths.length} of ${total}. Narrow the query or raise maxResults (max ${SEARCH_MAX}).`;
  }
  return JSON.stringify(out);
}

async function fileGrep(
  { query, basePath, regex, glob, maxResults },
  folderPath,
) {
  requireFolder(folderPath);
  const f = await getFinder(basePath || folderPath, folderPath);
  const pageSize = clampResults(maxResults, GREP_DEFAULT, GREP_MAX);
  const result = f.grep(query, {
    mode: regex ? "regex" : "plain",
    smartCase: true,
    beforeContext: 1,
    afterContext: 1,
    classifyDefinitions: true,
    pageSize,
  });
  if (!result.ok) throw new Error(result.error);

  const filter = glob ? globToRegExp(glob) : null;
  const hits = result.value.items
    .filter((item) => !filter || filter.test(item.relativePath))
    .map((item) => ({
      file: item.relativePath,
      line: item.lineNumber,
      text: item.lineContent.trim(),
    }));
  const total = result.value.totalMatched;
  const out = {
    totalMatched: total,
    filesSearched: result.value.totalFilesSearched,
    hits,
  };
  if (total > pageSize) {
    out.note = `Showing ${hits.length} of ${total} matches. Narrow the query, add a glob, or raise maxResults (max ${GREP_MAX}).`;
  }
  return JSON.stringify(out);
}

const definitions = [
  {
    type: "function",
    function: {
      name: "fileSearch",
      description:
        "Find files by name with fuzzy matching. Use this to locate a file when you know part of its name. Returns 20 paths by default.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query." },
          basePath: {
            type: "string",
            description:
              "The base directory to search. Defaults to the working directory.",
          },
          maxResults: {
            type: "integer",
            description: `Paths to return. Default ${SEARCH_DEFAULT}, max ${SEARCH_MAX}.`,
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "fileGrep",
      description:
        "Search file contents for a text pattern. Returns matching lines with file paths and line numbers. Use this to find where a name, function, or string appears. Plain text by default; set regex for a pattern. Use glob to limit the file set.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The content search query." },
          basePath: {
            type: "string",
            description:
              "The base directory to search. Defaults to the working directory.",
          },
          regex: {
            type: "boolean",
            description: "Treat query as a regular expression. Default false.",
          },
          glob: {
            type: "string",
            description:
              'Only return hits from files that match this glob, e.g. "*.vue" or "src/**/*.js".',
          },
          maxResults: {
            type: "integer",
            description: `Matches to return. Default ${GREP_DEFAULT}, max ${GREP_MAX}.`,
          },
        },
        required: ["query"],
      },
    },
  },
];

module.exports = {
  fileSearch,
  fileGrep,
  globToRegExp,
  definitions,
  SEARCH_DEFAULT,
  SEARCH_MAX,
  GREP_DEFAULT,
  GREP_MAX,
};
