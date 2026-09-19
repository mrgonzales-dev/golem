import { chat } from "../src/ai-bridge";
import * as fs from "fs";
import * as path from "path";

const configPath = path.join(__dirname, "../config/", "api_key.json");
const raw = fs.readFileSync(configPath, "utf-8");
const configData = JSON.parse(raw);
const config = { host: configData.host, apiKey: configData.key };

describe("AI reading tool", () => {
  test("chat() accepts tools option and returns toolCalls", async () => {
    const messages = [
      {
        role: "user",
        content: "Read the file at /tmp/test.txt",
      },
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "readFile",
          description: "Read a local file and return its content.",
          parameters: {
            type: "object",
            properties: {
              filePath: { type: "string", description: "Path to the file." },
            },
            required: ["filePath"],
          },
        },
      },
    ];

    const reply = await chat(messages, "wbridge/glm-5.2", { tools }, undefined, undefined, config);

    console.log("[test] reply:", JSON.stringify(reply, null, 2));

    expect(reply).toBeDefined();
    expect(reply.toolCalls).toBeDefined();
    expect(Array.isArray(reply.toolCalls)).toBe(true);
  }, 30000);
});
