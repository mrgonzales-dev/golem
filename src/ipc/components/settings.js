const axios = require("axios");

module.exports = {
  name: "settings:test",
  handler: async (_e, { host, apiKey }) => {
    if (!host || !apiKey) {
      return { ok: false, error: "Host and API key are required." };
    }

    try {
      const res = await axios.get(`${host}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 10000,
      });

      const count = res.data.data ? res.data.data.length : 0;
      return { ok: true, modelCount: count };
    } catch (err) {
      const message = err.response
        ? `HTTP ${err.response.status}: ${err.response.statusText}`
        : err.message;
      return { ok: false, error: message };
    }
  },
};
