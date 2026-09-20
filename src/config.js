const axios = require("axios");
const { getModelMeta } = require("@/models-dev");

// LM Studio's /api/v0/models returns max_context_length per model.
// Other providers do not have it — the request fails and the map
// stays empty so the UI falls back to a manual setting.
async function getContextLengths(host, apiKey) {
  try {
    const origin = new URL(host).origin;
    const res = await axios.get(`${origin}/api/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const map = {};
    for (const m of res.data.data || []) {
      if (m.max_context_length) map[m.id] = m.max_context_length;
    }
    return map;
  } catch {
    return {};
  }
}

async function getModels(host, apiKey) {
  const res = await axios.get(`${host}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const models = res.data.data.map((m) => m.id);
  const [contextMap, metaMap] = await Promise.all([
    getContextLengths(host, apiKey),
    getModelMeta(models),
  ]);
  // The provider's own report wins; models.dev fills the gaps.
  for (const [id, meta] of Object.entries(metaMap)) {
    if (!contextMap[id] && meta.context) contextMap[id] = meta.context;
  }
  return { models, contextMap, metaMap };
}

module.exports = { getModels };
