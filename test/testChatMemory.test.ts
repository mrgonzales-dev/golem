import { chat } from "../src/ai-bridge";
import * as fs from "fs";
import * as path from "path";

const configPath = path.join(__dirname, "../config/", "api_key.json");
const raw = fs.readFileSync(configPath, "utf-8");
const configData = JSON.parse(raw);
const config = { host: configData.host, apiKey: configData.key };

describe("AI chat memory", () => {
  test("AI remembers previous messages in the same conversation", async () => {
    // First message: tell the AI a name
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Remember the name: TypeScript" },
    ];

    console.log("[test] Step 1: Sending first message...");
    const reply1 = await chat(messages, "wbridge/glm-5.2", {}, undefined, undefined, config);
    console.log("[test] Step 1 reply:", reply1.content);
    expect(reply1.content).toBeDefined();

    // Add AI reply to history, then ask it to recall the name
    messages.push({ role: "assistant", content: reply1.content });
    messages.push({ role: "user", content: "What name did I tell you?" });

    console.log("[test] Step 2: Asking AI to recall the name...");
    const reply2 = await chat(messages, "wbridge/glm-5.2", {}, undefined, undefined, config);
    console.log("[test] Step 2 reply:", reply2.content);
    console.log("[test] Step 2 usage:", JSON.stringify(reply2.usage, null, 2));

    expect(reply2.content).toBeDefined();
    expect(reply2.content.toLowerCase()).toContain("typescript");
  }, 60000);
});
