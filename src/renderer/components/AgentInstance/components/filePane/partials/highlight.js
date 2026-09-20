/**
 * Read-only syntax highlighting for the file pane.
 *
 * highlight.js runs over the whole file once — per-line calls would
 * lose context and break multi-line comments and strings. The HTML
 * is then split back into lines so the viewer can keep its per-line
 * row layout (line numbers stay aligned when text wraps).
 *
 * Renderer-safe: no fs, no Electron imports.
 */
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github-dark.css";

// Extension to canonical language name. hljs resolves aliases at
// highlight time, but this function reports canonical names, so
// common alias extensions are mapped here. Unmapped extensions go
// through verbatim — most are already canonical (json, css, rust).
const EXT_ALIAS = {
  vue: "xml",
  html: "xml",
  htm: "xml",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  zsh: "bash",
  yml: "yaml",
  md: "markdown",
  mk: "makefile",
  cs: "csharp",
};

const CANONICAL = new Set(hljs.listLanguages());

export function languageForPath(filePath) {
  const base = (filePath || "").split(/[\\/]/).pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return "";
  const ext = base.slice(dot + 1).toLowerCase();
  if (EXT_ALIAS[ext]) return EXT_ALIAS[ext];
  if (CANONICAL.has(ext)) return ext;
  // Unmapped alias — hljs accepts it at highlight time even though
  // it is not a canonical name.
  return hljs.getLanguage(ext) ? ext : "";
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Splits highlighted HTML at newlines inside text nodes. Open tags
// are closed at each break and reopened on the next line, so every
// returned line is balanced and safe for v-html.
function splitHtmlLines(html) {
  const lines = [];
  const open = [];
  let cur = "";
  const re = /<\/?[a-zA-Z][^>]*>|[^<]+/g;
  const tagName = (t) => t.match(/^<\/?([a-zA-Z]+)/)[1];
  let m;
  while ((m = re.exec(html))) {
    const tok = m[0];
    if (tok[0] === "<") {
      cur += tok;
      if (tok[1] === "/") open.pop();
      else if (!tok.endsWith("/>")) open.push(tok);
    } else {
      const parts = tok.split("\n");
      for (let i = 0; i < parts.length; i++) {
        cur += parts[i];
        if (i < parts.length - 1) {
          for (let j = open.length - 1; j >= 0; j--) {
            cur += `</${tagName(open[j])}>`;
          }
          lines.push(cur);
          cur = open.join("");
        }
      }
    }
  }
  lines.push(cur);
  return lines;
}

// One HTML string per source line. Unknown languages and highlight
// failures degrade to escaped plaintext — the viewer never breaks.
export function highlightLines(code, filePath) {
  if (!code) return [];
  const lang = languageForPath(filePath);
  if (!lang) return escapeHtml(code).split("\n");
  try {
    return splitHtmlLines(hljs.highlight(code, { language: lang }).value);
  } catch {
    return escapeHtml(code).split("\n");
  }
}
