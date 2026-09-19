const axios = require("axios");

async function getModels(host, apiKey) {
  const res = await axios.get(`${host}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const models = res.data.data.map((m) => m.id);
  return models;
}

module.exports = { getModels };
