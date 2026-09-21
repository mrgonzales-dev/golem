/**
 * shellResolve.js — picks the shell binary for each OS.
 *
 * getDefaultShell() returns powershell on win32, zsh on mac,
 * bash on linux (honors $SHELL). resolveShellConfig() merges
 * a user pick with safe login args. Pure logic, no spawn here.
 */
function getDefaultShell(platform) {
  const plat = platform || process.platform;
  if (plat === "win32") return "powershell.exe";
  if (plat === "darwin") return process.env.SHELL || "/bin/zsh";
  return process.env.SHELL || "/bin/bash";
}

function getDefaultArgs(platform, shell) {
  const plat = platform || process.platform;
  if (plat === "win32") return ["-NoLogo"];
  if (shell && shell.includes("powershell")) return ["-NoLogo"];
  return ["--login"];
}

function resolveShellConfig({ shell, args, platform } = {}) {
  const plat = platform || process.platform;
  const cleanShell = typeof shell === "string" ? shell.trim() : "";
  const finalShell = cleanShell || getDefaultShell(plat);
  const finalArgs = Array.isArray(args) ? args : getDefaultArgs(plat, finalShell);
  return { shell: finalShell, args: finalArgs };
}

module.exports = { getDefaultShell, getDefaultArgs, resolveShellConfig };
