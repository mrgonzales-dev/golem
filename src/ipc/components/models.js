/**
 * IPC handler for model list requests.
 * Fetches all available models from the API and returns them as an array.
 *
 * @returns {Promise<{ok: boolean, models?: string[], error?: string}>}
 */
const { getModels } = require("@/config");

module.exports = {
  name: "get-models",
  handler: async (_e, { host, apiKey }) => {
    try {
      const { models, contextMap, metaMap } = await getModels(host, apiKey);
      return { ok: true, models, contextMap, metaMap };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};
