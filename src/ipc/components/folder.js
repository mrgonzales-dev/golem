const fs = require("fs");

module.exports = {
  name: "folder:readContents",
  handler: async (_event, folderPath) => {
    try {
      const dirents = await fs.promises.readdir(folderPath, { withFileTypes: true });
      const entries = dirents.map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory(),
      }));
      return { ok: true, entries };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
};
