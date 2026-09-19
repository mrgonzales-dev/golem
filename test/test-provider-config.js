// Standalone test for providerConfig — run: node test/test-provider-config.js

// localStorage polyfill
const store = new Map();
globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
};

const {
  getProviderConfig,
  saveProviderConfig,
  hasProviderConfig,
} = require("../src/renderer/components/Settings/partials/providerConfig");

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  const match = JSON.stringify(actual) === JSON.stringify(expected);
  if (match) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.log(`  FAIL: ${label}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log(
  "\nTest: getProviderConfig returns empty values when nothing saved",
);
localStorage.clear();
assert("host", getProviderConfig().host, "");
assert("apiKey", getProviderConfig().apiKey, "");

console.log("\nTest: hasProviderConfig returns false when nothing saved");
localStorage.clear();
assert("hasProviderConfig", hasProviderConfig(), false);

console.log("\nTest: saveProviderConfig stores host and apiKey");
localStorage.clear();
saveProviderConfig("http://localhost:1234", "sk-test123");
assert(
  "host in localStorage",
  localStorage.getItem("providerHost"),
  "http://localhost:1234",
);
assert(
  "apiKey in localStorage",
  localStorage.getItem("providerApiKey"),
  "sk-test123",
);

console.log("\nTest: getProviderConfig returns saved values");
localStorage.clear();
saveProviderConfig("http://localhost:1234", "sk-test123");
assert("host", getProviderConfig().host, "http://localhost:1234");
assert("apiKey", getProviderConfig().apiKey, "sk-test123");

console.log("\nTest: hasProviderConfig returns true when both saved");
localStorage.clear();
saveProviderConfig("http://localhost:1234", "sk-test123");
assert("hasProviderConfig", hasProviderConfig(), true);

console.log("\nTest: hasProviderConfig returns false when host missing");
localStorage.clear();
saveProviderConfig("", "sk-test123");
assert("hasProviderConfig", hasProviderConfig(), false);

console.log("\nTest: hasProviderConfig returns false when apiKey missing");
localStorage.clear();
saveProviderConfig("http://localhost:1234", "");
assert("hasProviderConfig", hasProviderConfig(), false);

console.log("\nTest: saveProviderConfig overwrites previous values");
localStorage.clear();
saveProviderConfig("http://localhost:1234", "sk-old");
saveProviderConfig("http://localhost:9999", "sk-new");
assert("host", getProviderConfig().host, "http://localhost:9999");
assert("apiKey", getProviderConfig().apiKey, "sk-new");

console.log("\nTest: getProviderConfig returns empty strings after clear");
localStorage.clear();
saveProviderConfig("http://localhost:1234", "sk-test123");
localStorage.clear();
assert("host", getProviderConfig().host, "");
assert("apiKey", getProviderConfig().apiKey, "");

// ---------------------------------------------------------------------------
// Live API connection test — set your own host and apiKey below, then run.
// Usage: node test/test-provider-config.js --live
// ---------------------------------------------------------------------------

const LIVE_HOST = ""; // e.g. "http://localhost:1234"
const LIVE_API_KEY = ""; // e.g. "sk-xxxx"

async function testLiveConnection(host, apiKey) {
  console.log("\n--- Live API Connection Test ---");
  console.log(`  Host:    ${host}`);
  console.log(`  API Key: ${apiKey ? "***" + apiKey.slice(-4) : "(empty)"}`);

  if (!host || !apiKey) {
    console.log(
      "  SKIP: Set LIVE_HOST and LIVE_API_KEY at the top of this file.",
    );
    return;
  }

  try {
    const res = await fetch(`${host}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      console.log(`  FAIL: HTTP ${res.status} ${res.statusText}`);
      return;
    }

    const data = await res.json();
    const models = data.data || [];
    console.log(`  PASS: Connected. ${models.length} models available.`);
    models.forEach((m) => console.log(`    - ${m.id}`));
  } catch (err) {
    console.log(`  FAIL: ${err.message}`);
  }
}

const runLive = process.argv.includes("--live");

if (runLive) {
  testLiveConnection(LIVE_HOST, LIVE_API_KEY).then(() => {
    console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
    process.exit(failed > 0 ? 1 : 0);
  });
} else {
  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
  console.log("\nTip: Set LIVE_HOST and LIVE_API_KEY at the top of this file,");
  console.log("     then run: node test/test-provider-config.js --live");
  process.exit(failed > 0 ? 1 : 0);
}
