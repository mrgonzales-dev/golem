import { AgentSession } from "@/ipc/components/agent";
import * as fs from "fs";
import * as path from "path";

const configPath = path.join(__dirname, "../config/", "api_key.json");
const raw = fs.readFileSync(configPath, "utf-8");
const configData = JSON.parse(raw);
const config = { host: configData.host, apiKey: configData.key };

describe("AI tool calling end-to-end", () => {
  const tmpDir = path.join(__dirname, "tmp-toolcall");
  const tmpFile = path.join(tmpDir, "doc.txt");
  let session: AgentSession;

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
    fs.writeFileSync(tmpFile, "The sky is blue and the grass is green.");
    console.log("[setup] Created test file:", tmpFile);
  });

  afterAll(() => {
    fs.unlinkSync(tmpFile);
    fs.rmSync(tmpDir, { recursive: true });
    console.log("[teardown] Removed test file and tmp dir");
  });

  beforeEach(() => {
    session = new AgentSession();
  });

  test("AI calls readFile tool and uses the result", async () => {
    const result = await session.handle(
      {},
      { message: `Read the file at ${tmpFile} and tell me what it says.`, model: "wbridge/glm-5.2", ...config }
    );

    console.log("[test] Reply:", result.reply);
    console.log("[test] OK:", result.ok);
    console.log("[test] Error:", result.error);
    console.log("[test] Usage:", JSON.stringify(result.usage, null, 2));

    expect(result.ok).toBe(true);
    expect(result.reply).toBeDefined();
    expect(result.reply.toLowerCase()).toContain("blue");
  }, 60000);
});
