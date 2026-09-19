import { readFile } from "../src/tools";
import * as fs from "fs";
import * as path from "path";

describe("readFile tool", () => {
  const tmpDir = path.join(__dirname, "tmp-readfile");
  const tmpFile = path.join(tmpDir, "test.txt");

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    fs.writeFileSync(tmpFile, "hello world");
    console.log("[setup] Created tmp dir:", tmpDir);
    console.log("[setup] Created test file:", tmpFile);
  });

  afterAll(() => {
    fs.unlinkSync(tmpFile);
    fs.rmSync(tmpDir, { recursive: true });
    console.log("[teardown] Removed test file and tmp dir");
  });

  test("reads a file and returns its content", () => {
    console.log("[test] Reading file:", tmpFile);
    const content = readFile({ filePath: tmpFile });
    console.log("[test] File content:", JSON.stringify(content));
    console.log("[test] Content length:", content.length, "chars");
    expect(content).toBe("hello world");
    console.log("[test] PASS: content matches expected 'hello world'");
  });

  test("throws on non-existent file", () => {
    const badPath = "/nonexistent/path/file.txt";
    console.log("[test] Attempting to read non-existent file:", badPath);
    expect(() => readFile({ filePath: badPath })).toThrow();
    console.log("[test] PASS: threw error as expected");
  });

  test("throws on directory path", () => {
    console.log("[test] Attempting to read directory as file:", tmpDir);
    expect(() => readFile({ filePath: tmpDir })).toThrow();
    console.log("[test] PASS: threw error for directory path");
  });
});
