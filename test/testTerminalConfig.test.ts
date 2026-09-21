import { sanitizeDims, buildPtyOptions, DEFAULT_COLS, DEFAULT_ROWS } from "../src/terminal-system/terminalConfig";

describe("terminalConfig", () => {
  test("exposes sane defaults", () => {
    expect(DEFAULT_COLS).toBe(80);
    expect(DEFAULT_ROWS).toBe(24);
  });

  test("sanitizeDims clamps bad values to defaults", () => {
    expect(sanitizeDims(80, 24)).toEqual({ cols: 80, rows: 24 });
    expect(sanitizeDims(0, -5)).toEqual({ cols: DEFAULT_COLS, rows: DEFAULT_ROWS });
    expect(sanitizeDims(1000, 1000).cols).toBeLessThanOrEqual(500);
    expect(sanitizeDims("x", NaN)).toEqual({ cols: DEFAULT_COLS, rows: DEFAULT_ROWS });
  });

  test("buildPtyOptions merges cwd and dims", () => {
    const opts = buildPtyOptions({ cwd: "/tmp", cols: 120, rows: 30, shellName: "xterm-256color" });
    expect(opts.cwd).toBe("/tmp");
    expect(opts.cols).toBe(120);
    expect(opts.rows).toBe(30);
    expect(opts.name).toBe("xterm-256color");
  });
});
