/**
 * runCommand: one stateless shell command in the working directory.
 */
const { exec } = require("child_process");
const { requireFolder, clampResults } = require("./shared");

// Command timeouts in seconds. Test suites and builds often pass 30s,
// so the default is generous and the model can raise it further.
const COMMAND_TIMEOUT_DEFAULT = 120;
const COMMAND_TIMEOUT_MAX = 600;

/**
 * Run a shell command in the working directory and return its output.
 * Uses the platform default shell (cmd.exe on Windows, /bin/sh elsewhere).
 * Stateless: each call starts a fresh shell, so cd and env changes do
 * not persist between calls. An interrupt kills the child process.
 * @param {Object} args - { command, timeoutSeconds }.
 * @param {string} folderPath - The working directory.
 * @param {Object} [ctx] - { signal } from the agent loop.
 * @returns {Promise<string>} Combined stdout/stderr plus the exit code.
 */
function runCommand({ command, timeoutSeconds } = {}, folderPath, ctx = {}) {
  requireFolder(folderPath);
  if (!command || !command.trim()) {
    throw new Error("command must not be empty.");
  }
  const seconds = clampResults(
    timeoutSeconds,
    COMMAND_TIMEOUT_DEFAULT,
    COMMAND_TIMEOUT_MAX,
  );
  const signal = ctx.signal;
  return new Promise((resolve) => {
    let aborted = false;
    const child = exec(
      command,
      {
        cwd: folderPath,
        timeout: seconds * 1000,
        maxBuffer: 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (signal) signal.removeEventListener("abort", onAbort);
        const output = [stdout, stderr]
          .filter(Boolean)
          .join("\n")
          .trim();
        const clipped =
          output.length > 20000
            ? output.slice(0, 20000) + "\n... [output truncated]"
            : output;
        if (aborted) {
          return resolve(`${clipped}\n\nError: command was interrupted by the user.`);
        }
        if (err && err.killed) {
          return resolve(
            `${clipped}\n\nError: command timed out after ${seconds}s and was killed. Pass a larger timeoutSeconds (max ${COMMAND_TIMEOUT_MAX}) for long tasks.`,
          );
        }
        const code = err ? err.code ?? 1 : 0;
        resolve(`${clipped}\n(exit ${code})`.trim());
      },
    );
    const onAbort = () => {
      aborted = true;
      child.kill();
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

const definitions = [
  {
    type: "function",
    function: {
      name: "runCommand",
      description: `Run a shell command in the working directory and return its combined stdout/stderr plus exit code. Uses the platform default shell. Stateless: cd and environment changes do not persist between calls. Default timeout ${COMMAND_TIMEOUT_DEFAULT}s; long-running servers will be killed. Use it for builds, tests, and git.`,
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to run.",
          },
          timeoutSeconds: {
            type: "integer",
            description: `Seconds before the command is killed. Default ${COMMAND_TIMEOUT_DEFAULT}, max ${COMMAND_TIMEOUT_MAX}.`,
          },
        },
        required: ["command"],
      },
    },
  },
];

module.exports = {
  runCommand,
  definitions,
  COMMAND_TIMEOUT_DEFAULT,
  COMMAND_TIMEOUT_MAX,
};
