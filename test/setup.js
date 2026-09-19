const path = require("path");
require("module-alias").addAlias("@", path.resolve(__dirname, "..", "src"));

// localStorage polyfill for tests that use browser storage APIs
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}
