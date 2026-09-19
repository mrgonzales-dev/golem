import { AgentSession } from "@/ipc/components/agent";
import * as fs from "fs";
import * as path from "path";

const configPath = path.join(__dirname, "../config/", "api_key.json");
const raw = fs.readFileSync(configPath, "utf-8");
const configData = JSON.parse(raw);
const config = { host: configData.host, apiKey: configData.key };

describe("Chat handler memory", () => {
  let session: AgentSession;

  beforeEach(() => {
    session = new AgentSession();
  });

  test("handler stores conversation history across calls", async () => {
    // First call: user says something
    const result1 = await session.handle({}, { message: "Remember the name: Rust", model: "wbridge/glm-5.2", ...config });
    console.log("[test] Call 1 reply:", result1.reply);
    expect(result1.ok).toBe(true);

    // Second call: user asks to recall
    const result2 = await session.handle({}, { message: "What name did I tell you?", model: "wbridge/glm-5.2", ...config });
    console.log("[test] Call 2 reply:", result2.reply);
    console.log("[test] Call 2 usage:", JSON.stringify(result2.usage, null, 2));

    expect(result2.ok).toBe(true);
    expect(result2.reply.toLowerCase()).toContain("rust");
  }, 60000);

  test("clearHistory resets conversation", async () => {
    // Store a name
    await session.handle({}, { message: "Remember the name: Python", model: "wbridge/glm-5.2", ...config });

    // Clear history
    session.clearHistory();

    // AI should not remember the name
    const result = await session.handle({}, { message: "What name did I tell you?", model: "wbridge/glm-5.2", ...config });
    console.log("[test] After clear, reply:", result.reply);

    expect(result.ok).toBe(true);
    expect(result.reply.toLowerCase()).not.toContain("python");
  }, 60000);
});
