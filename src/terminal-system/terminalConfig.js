/**
 * terminalConfig.js — default grid size and PTY options for Golem.
 *
 * Owns DEFAULT_COLS/ROWS, clamps bad dims via sanitizeDims(),
 * and builds node-pty options via buildPtyOptions().
 * No native code runs here; pure logic so tests stay fast.
 */
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const MAX_COLS = 500;
const MAX_ROWS = 500;
const MIN_DIM = 2;

function toInt(value, fallback) {
  const n = typeof value === "number" ? value : parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
}

function sanitizeDims(cols, rows) {
  let c = toInt(cols, DEFAULT_COLS);
  let r = toInt(rows, DEFAULT_ROWS);
  if (c < MIN_DIM) c = DEFAULT_COLS;
  if (r < MIN_DIM) r = DEFAULT_ROWS;
  c = Math.min(c, MAX_COLS);
  r = Math.min(r, MAX_ROWS);
  return { cols: c, rows: r };
}

function buildPtyOptions({ cwd, cols, rows, shellName, env } = {}) {
  const dims = sanitizeDims(cols ?? DEFAULT_COLS, rows ?? DEFAULT_ROWS);
  return {
    name: shellName || "xterm-256color",
    cwd: cwd || process.cwd(),
    cols: dims.cols,
    rows: dims.rows,
    env: env || process.env,
  };
}

module.exports = {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  MAX_COLS,
  MAX_ROWS,
  sanitizeDims,
  buildPtyOptions,
};
