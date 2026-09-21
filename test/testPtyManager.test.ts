import { createPtyManager } from "../src/terminal-system/ptyManager";

function fakeSpawn(_shell, _args, _opts) {
  const dataHandlers = [];
  const exitHandlers = [];
  return {
    pid: 1234,
    cols: _opts.cols,
    rows: _opts.rows,
    written: [],
    write(data) {
      this.written.push(data);
    },
    resize(cols, rows) {
      this.cols = cols;
      this.rows = rows;
    },
    kill() {
      exitHandlers.forEach((fn) => fn({ exitCode: 0, signal: 0 }));
    },
    onData(fn) {
      dataHandlers.push(fn);
      return { dispose() {} };
    },
    onExit(fn) {
      exitHandlers.push(fn);
      return { dispose() {} };
    },
    __emitData(d) {
      dataHandlers.forEach((fn) => fn(d));
    },
  };
}

describe("ptyManager", () => {
  test("create tracks session and emits data", () => {
    const mgr = createPtyManager({ spawn: fakeSpawn });
    const seen = [];
    const session = mgr.create("a", { cwd: "/tmp", cols: 80, rows: 24 });
    expect(session.id).toBe("a");
    mgr.onData("a", (d) => seen.push(d));
    mgr.emitForTest("a", "hello");
    expect(seen).toEqual(["hello"]);
  });

  test("write and resize forward to pty", () => {
    const mgr = createPtyManager({ spawn: fakeSpawn });
    mgr.create("b", { cwd: "/tmp", cols: 80, rows: 24 });
    mgr.write("b", "ls\n");
    mgr.resize("b", 120, 30);
    expect(mgr.get("b").pty.cols).toBe(120);
    expect(mgr.get("b").pty.rows).toBe(30);
    expect(mgr.get("b").pty.written).toEqual(["ls\n"]);
  });

  test("duplicate create throws", () => {
    const mgr = createPtyManager({ spawn: fakeSpawn });
    mgr.create("c", { cwd: "/tmp", cols: 80, rows: 24 });
    expect(() => mgr.create("c", { cwd: "/tmp", cols: 80, rows: 24 })).toThrow();
  });

  test("kill removes session and fires exit", () => {
    const mgr = createPtyManager({ spawn: fakeSpawn });
    let code = null;
    mgr.create("d", { cwd: "/tmp", cols: 80, rows: 24 });
    mgr.onExit("d", (e) => (code = e.exitCode));
    mgr.kill("d");
    expect(code).toBe(0);
    expect(mgr.list()).toEqual([]);
  });

  test("write to missing session throws", () => {
    const mgr = createPtyManager({ spawn: fakeSpawn });
    expect(() => mgr.write("nope", "x")).toThrow();
  });
});
