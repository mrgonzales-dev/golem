/**
 * Model metadata from the public models.dev catalog.
 *
 * Provider /models endpoints only return ids — no context limits or
 * reasoning capability. models.dev ships one JSON catalog keyed by
 * provider, each model carrying limit.context and reasoning.
 *
 * The catalog is cached on disk in the Electron userData dir with a
 * TTL so lookups stay fast and work offline after the first fetch.
 * Every failure path returns {} so callers can fall back cleanly.
 */
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

const CATALOG_URL = "https://models.dev/api.json";
const TTL_MS = 6 * 60 * 60 * 1000;

function cachePath() {
  try {
    const { app } = require("electron");
    return path.join(app.getPath("userData"), "models-dev.json");
  } catch {
    return path.join(os.tmpdir(), "golem-models-dev.json");
  }
}

async function loadCatalog() {
  const file = cachePath();
  try {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs < TTL_MS) {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    }
  } catch {}

  try {
    const res = await axios.get(CATALOG_URL, { timeout: 10000 });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(res.data));
    fs.renameSync(tmp, file);
    return res.data;
  } catch {
    // Stale cache beats nothing — serve it past TTL when offline.
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return {};
    }
  }
}

// Catalog shape: { providerId: { models: { modelId: meta } } }.
// A provider may prefix ids ("deepseek/deepseek-v4.1-flash"), so try
// the bare id and the suffix after the last "/".
function findMeta(catalog, modelId) {
  const bare = modelId.split("/").pop();
  for (const provider of Object.values(catalog)) {
    const models = provider && provider.models;
    if (!models) continue;
    if (models[modelId]) return models[modelId];
    if (models[bare]) return models[bare];
  }
  return null;
}

/**
 * Build a metadata map for a list of provider model ids.
 * @param {string[]} modelIds
 * @returns {Promise<Object<string, {context: number|null, reasoning: boolean|null, efforts: string[]}>>}
 */
async function getModelMeta(modelIds) {
  const catalog = await loadCatalog();
  const metaMap = {};
  for (const id of modelIds) {
    const m = findMeta(catalog, id);
    if (!m) continue;
    const reasoning = typeof m.reasoning === "boolean" ? m.reasoning : null;
    metaMap[id] = {
      context: m.limit && m.limit.context ? m.limit.context : null,
      reasoning,
      // The catalog only reports whether a model reasons, not which
      // effort labels it takes. OpenAI-compatible providers all accept
      // this standard trio; the chat retry strips it when rejected.
      efforts: reasoning ? ["low", "medium", "high"] : [],
    };
  }
  return metaMap;
}

module.exports = { getModelMeta };
