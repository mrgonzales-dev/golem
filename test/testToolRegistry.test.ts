import { toolDefinitions, toolFunctions } from "../src/tools";

describe("Tool registry", () => {
  test("toolDefinitions is an array", () => {
    expect(Array.isArray(toolDefinitions)).toBe(true);
    expect(toolDefinitions.length).toBeGreaterThan(0);
  });

  test("toolDefinitions contains readFile", () => {
    const readFileDef = toolDefinitions.find((t) => t.function.name === "readFile");
    expect(readFileDef).toBeDefined();
    expect(readFileDef.type).toBe("function");
    expect(readFileDef.function.description).toBeDefined();
    expect(readFileDef.function.parameters).toBeDefined();
  });

  test("toolFunctions contains readFile execute function", () => {
    expect(toolFunctions.readFile).toBeDefined();
    expect(typeof toolFunctions.readFile).toBe("function");
  });

  test("toolFunctions.readFile reads a file correctly", () => {
    const fs = require("fs");
    const path = require("path");
    const tmpDir = path.join(__dirname, "tmp-registry");
    const tmpFile = path.join(tmpDir, "registry-test.txt");

    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    fs.writeFileSync(tmpFile, "registry test content");

    // Throws on non-existent file
    expect(() => toolFunctions.readFile({ filePath: "/nonexistent" })).toThrow();

    // Read the actual file
    const result = toolFunctions.readFile({ filePath: tmpFile });
    expect(result).toBe("registry test content");

    fs.unlinkSync(tmpFile);
    fs.rmSync(tmpDir, { recursive: true });
  });
});
