const { loadConfig } = require("./src/config");

async function testConnection() {
  const { host, apiKey } = loadConfig();
  console.log("Host:", host);
  console.log("API Key:", apiKey ? "Loaded" : "Missing");

  try {
    const res = await fetch(`${host}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      console.log("API connection failed:", res.status, res.statusText);
      return;
    }

    const data = await res.json();
    console.log("API connection OK.");
    console.log("Available models:", data.data?.map((m) => m.id).join(", "));
  } catch (err) {
    console.log("API connection error:", err.message);
  }
}

testConnection();
