import { getDefaultShell, resolveShellConfig } from "../src/terminal-system/shellResolve";

describe("shellResolve", () => {
  test("picks win32 shell", () => {
    expect(getDefaultShell("win32")).toBe("powershell.exe");
  });

  test("picks posix shell", () => {
    expect(getDefaultShell("darwin")).toMatch(/zsh|bash|sh/);
    expect(getDefaultShell("linux")).toMatch(/bash|zsh|sh/);
  });

  test("resolveShellConfig honors explicit shell", () => {
    const cfg = resolveShellConfig({ shell: "/bin/fish", platform: "linux" });
    expect(cfg.shell).toBe("/bin/fish");
    expect(Array.isArray(cfg.args)).toBe(true);
  });

  test("resolveShellConfig falls back to default on empty", () => {
    const cfg = resolveShellConfig({ shell: "", platform: "win32" });
    expect(cfg.shell).toBe("powershell.exe");
  });
});
