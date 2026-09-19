const { dialog } = require("electron");

module.exports = {
  name: "dialog:openFolder",
  handler: async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, error: "No folder selected" };
    }

    return { ok: true, path: result.filePaths[0] };
  },
};
